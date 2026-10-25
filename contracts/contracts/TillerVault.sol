// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC4626, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStabilityPool, ITroveManager, IHintHelpers, ISortedTroves, IPriceFeed, IPool} from "./interfaces/IMezo.sol";

/// @title Tiller Finance MUSD vault
/// @notice Deposits earn from the Stability Pool and from redemption arbitrage that pushes MUSD back to $1.
/// The keeper (a bot reviewed by an AI risk check) can only act inside the limits enforced here.
contract TillerVault is ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    uint256 private constant BPS = 10_000;

    IStabilityPool public immutable stabilityPool;
    ITroveManager public immutable troveManager;
    IHintHelpers public immutable hintHelpers;
    ISortedTroves public immutable sortedTroves;
    IPriceFeed public immutable priceFeed;
    // On Mezo this ERC-20 precompile shares its balance with native BTC.
    IERC20 public immutable btc;

    uint16 public spCapBps = 8_000; // max share of assets in the Stability Pool
    uint16 public minIdleBps = 1_000; // MUSD kept liquid for withdrawals
    uint16 public maxSlippageBps = 150; // BTC->MUSD swaps must get at least oracle value minus this
    mapping(address => bool) public isPool;

    /// @notice One event per keeper decision, read by the dashboard's decision feed.
    event Decision(bytes32 indexed action, uint256 amount, uint256 result, string why);
    event LimitsSet(uint16 spCapBps, uint16 minIdleBps, uint16 maxSlippageBps);
    event PoolSet(address pool, bool allowed);

    error LimitBreached();
    error PoolNotAllowed();
    error SlippageTooHigh(uint256 out, uint256 minOut);
    error NoProfit(uint256 musdBefore, uint256 musdAfter);

    constructor(
        IERC20 musd,
        IStabilityPool _stabilityPool,
        ITroveManager _troveManager,
        IHintHelpers _hintHelpers,
        ISortedTroves _sortedTroves,
        IPriceFeed _priceFeed,
        IERC20 _btc,
        address admin
    ) ERC4626(musd) ERC20("Tiller MUSD", "tMUSD") {
        stabilityPool = _stabilityPool;
        troveManager = _troveManager;
        hintHelpers = _hintHelpers;
        sortedTroves = _sortedTroves;
        priceFeed = _priceFeed;
        btc = _btc;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);
    }

    // BTC arrives natively from the Stability Pool and from redemptions.
    receive() external payable {}

    // ---------- accounting ----------

    /// @dev Unharvested BTC gains are left out on purpose: the vault never reports more than it holds in MUSD.
    // shortcut: a deposit made just before a harvest shares in gains it didn't earn; value gains with an oracle haircut in Wave 2.
    function totalAssets() public view override returns (uint256) {
        return idleAssets() + stabilityPool.getCompoundedMUSDDeposit(address(this));
    }

    function idleAssets() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function pendingBtc() external view returns (uint256) {
        return btc.balanceOf(address(this)) + stabilityPool.getDepositorCollateralGain(address(this));
    }

    /// @dev Withdrawals pull from the Stability Pool when the idle buffer is short. Not blocked by pause.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        uint256 idle = idleAssets();
        if (idle < assets) stabilityPool.withdrawFromSP(assets - idle);
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        whenNotPaused
    {
        super._deposit(caller, receiver, assets, shares);
    }

    // ---------- keeper actions ----------

    function depositToStabilityPool(uint256 amount, string calldata why)
        external
        onlyRole(KEEPER_ROLE)
        whenNotPaused
        nonReentrant
    {
        // Mezo's Stability Pool pulls MUSD with transferFrom
        IERC20(asset()).forceApprove(address(stabilityPool), amount);
        stabilityPool.provideToSP(amount);
        uint256 assets = totalAssets();
        if (stabilityPool.getCompoundedMUSDDeposit(address(this)) * BPS > assets * spCapBps) revert LimitBreached();
        if (idleAssets() * BPS < assets * minIdleBps) revert LimitBreached();
        emit Decision("SP_DEPOSIT", amount, assets, why);
    }

    /// @notice Reduces risk, so the guardian can call it too and pause doesn't block it.
    function withdrawFromStabilityPool(uint256 amount, string calldata why) external nonReentrant {
        if (!hasRole(KEEPER_ROLE, msg.sender) && !hasRole(GUARDIAN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, KEEPER_ROLE);
        }
        stabilityPool.withdrawFromSP(amount);
        emit Decision("SP_WITHDRAW", amount, totalAssets(), why);
    }

    /// @notice Claims Stability Pool BTC gains and sells all BTC held for MUSD at no worse than oracle minus slippage.
    function harvest(address pool, string calldata why)
        external
        onlyRole(KEEPER_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (stabilityPool.getCompoundedMUSDDeposit(address(this)) > 0) stabilityPool.withdrawFromSP(0);
        uint256 btcAmount = btc.balanceOf(address(this));
        uint256 out = btcAmount == 0 ? 0 : _swapBtcForMusd(pool, btcAmount);
        emit Decision("HARVEST", btcAmount, out, why);
    }

    /// @notice Peg arbitrage: redeem MUSD for $1 of BTC, sell the BTC back into a pool where MUSD is under $1.
    /// Reverts unless the vault ends with at least `minProfit` more MUSD, so a bad plan can't lose money.
    function pegArb(
        uint256 musdIn,
        address pool,
        uint256 minProfit,
        string calldata why
    ) external onlyRole(KEEPER_ROLE) whenNotPaused nonReentrant {
        uint256 musdBefore = idleAssets();
        uint256 btcBefore = btc.balanceOf(address(this));
        _redeem(musdIn);
        _swapBtcForMusd(pool, btc.balanceOf(address(this)) - btcBefore);
        uint256 musdAfter = idleAssets();
        if (musdAfter < musdBefore + minProfit || musdAfter <= musdBefore) revert NoProfit(musdBefore, musdAfter);
        emit Decision("PEG_ARB", musdIn, musdAfter - musdBefore, why);
    }

    /// @notice Lets the keeper publish a decision that changes nothing, such as an AI veto.
    function note(string calldata why) external onlyRole(KEEPER_ROLE) {
        emit Decision("NOTE", 0, 0, why);
    }

    // ---------- admin ----------

    function setLimits(uint16 _spCapBps, uint16 _minIdleBps, uint16 _maxSlippageBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_spCapBps + _minIdleBps > BPS || _maxSlippageBps > 1_000) revert LimitBreached();
        (spCapBps, minIdleBps, maxSlippageBps) = (_spCapBps, _minIdleBps, _maxSlippageBps);
        emit LimitsSet(_spCapBps, _minIdleBps, _maxSlippageBps);
    }

    function setPool(address pool, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IPool p = IPool(pool);
        address musd = asset();
        bool pair = (p.token0() == musd && p.token1() == address(btc)) || (p.token0() == address(btc) && p.token1() == musd);
        if (!pair) revert PoolNotAllowed();
        isPool[pool] = allowed;
        emit PoolSet(pool, allowed);
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    // ---------- internal ----------

    /// @dev Hints are computed in the same transaction on purpose: Mezo's oracle moves every block, and a partial
    /// redemption is cancelled unless its hint matches the trove's new collateral ratio almost exactly.
    function _redeem(uint256 musdIn) internal {
        (address first, uint256 nicr,) = hintHelpers.getRedemptionHints(musdIn, priceFeed.fetchPrice(), 50);
        (address upper, address lower) = sortedTroves.findInsertPosition(nicr, first, first);
        troveManager.redeemCollateral(musdIn, first, upper, lower, nicr, 50);
    }

    function _swapBtcForMusd(address pool, uint256 btcAmount) internal returns (uint256 out) {
        if (!isPool[pool]) revert PoolNotAllowed();
        IPool p = IPool(pool);
        out = p.getAmountOut(btcAmount, address(btc));
        uint256 minOut = (btcAmount * priceFeed.fetchPrice() / 1e18) * (BPS - maxSlippageBps) / BPS;
        if (out < minOut) revert SlippageTooHigh(out, minOut);
        btc.safeTransfer(pool, btcAmount);
        (uint256 a0, uint256 a1) = p.token0() == asset() ? (out, uint256(0)) : (uint256(0), out);
        p.swap(a0, a1, address(this), "");
    }
}
