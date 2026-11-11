// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC4626, ERC20, IERC20, IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStabilityPool, ITroveManager, IHintHelpers, ISortedTroves, IPriceFeed, IPool} from "./interfaces/IMezo.sol";

/// @title Tiller Finance MUSD vault
/// @notice Deposits earn from the Stability Pool and from defending MUSD's $1 peg in both directions:
/// below $1 by redemption arbitrage or by buying MUSD back with a stablecoin, above $1 by selling MUSD for one.
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
    // mUSDC on Mezo: held only between selling MUSD above $1 and buying it back at $1 or less
    IERC20 public immutable stable;
    uint256 private immutable stableScale; // 10 ** (18 - stablecoin decimals)

    uint16 public spCapBps = 8_000; // max share of assets in the Stability Pool
    uint16 public minIdleBps = 1_000; // MUSD kept liquid for withdrawals
    uint16 public maxSlippageBps = 150; // BTC->MUSD swaps must get at least oracle value minus this
    uint16 public stableCapBps = 3_000; // max share of assets held as the stablecoin
    uint16 public minPremiumBps = 50; // sell MUSD only at $1.005 or more
    uint256 public depositCap; // max total assets; raised as the vault proves itself
    mapping(address => bool) public isPool; // MUSD/BTC pools
    mapping(address => bool) public isStablePool; // MUSD/stablecoin pools

    /// @notice One event per keeper decision, read by the dashboard's decision feed.
    event Decision(bytes32 indexed action, uint256 amount, uint256 result, string why);
    event LimitsSet(uint16 spCapBps, uint16 minIdleBps, uint16 maxSlippageBps);
    event StableLimitsSet(uint16 stableCapBps, uint16 minPremiumBps);
    event DepositCapSet(uint256 cap);
    event PoolSet(address pool, bool allowed);

    error LimitBreached();
    error PoolNotAllowed();
    error SlippageTooHigh(uint256 out, uint256 minOut);
    error NoProfit(uint256 musdBefore, uint256 musdAfter);
    error BadPrice(uint256 out, uint256 minOut);

    constructor(
        IERC20 musd,
        IStabilityPool _stabilityPool,
        ITroveManager _troveManager,
        IHintHelpers _hintHelpers,
        ISortedTroves _sortedTroves,
        IPriceFeed _priceFeed,
        IERC20 _btc,
        IERC20Metadata _stable,
        uint256 _depositCap,
        address admin
    ) ERC4626(musd) ERC20("Tiller MUSD", "tMUSD") {
        stabilityPool = _stabilityPool;
        troveManager = _troveManager;
        hintHelpers = _hintHelpers;
        sortedTroves = _sortedTroves;
        priceFeed = _priceFeed;
        btc = _btc;
        stable = _stable;
        stableScale = 10 ** (18 - _stable.decimals());
        depositCap = _depositCap;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);
    }

    // BTC arrives natively from the Stability Pool and from redemptions.
    receive() external payable {}

    // ---------- accounting ----------

    /// @dev Unharvested BTC gains are left out on purpose: the vault never reports more than it holds in dollars.
    /// The stablecoin counts at $1, the price the vault buys MUSD back at.
    // shortcut: a deposit made just before a harvest shares in gains it didn't earn; value BTC gains with an oracle haircut once harvests are large.
    function totalAssets() public view override returns (uint256) {
        return liquidAssets() + stableAssets();
    }

    /// @notice MUSD the vault can pay out right now: idle plus the Stability Pool deposit.
    function liquidAssets() public view returns (uint256) {
        return idleAssets() + stabilityPool.getCompoundedMUSDDeposit(address(this));
    }

    function idleAssets() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function stableAssets() public view returns (uint256) {
        return stable.balanceOf(address(this)) * stableScale;
    }

    function pendingBtc() external view returns (uint256) {
        return btc.balanceOf(address(this)) + stabilityPool.getDepositorCollateralGain(address(this));
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 assets = totalAssets();
        return assets >= depositCap ? 0 : depositCap - assets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return convertToShares(maxDeposit(receiver));
    }

    /// @dev Withdrawals are paid in MUSD, so they're limited to liquid MUSD. The stablecoin sleeve is capped,
    /// and the keeper or guardian can always unwind it.
    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 m = super.maxWithdraw(owner);
        uint256 liquid = liquidAssets();
        return m < liquid ? m : liquid;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 m = super.maxRedeem(owner);
        // with no stablecoin held everything is liquid; skipping the conversion avoids rounding the last holder out
        if (stable.balanceOf(address(this)) == 0) return m;
        uint256 liquid = convertToShares(liquidAssets());
        return m < liquid ? m : liquid;
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
        _onlyKeeperOrGuardian();
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
    /// Returns the profit, so the keeper sizes trades by simulating this call.
    function pegArb(
        uint256 musdIn,
        address pool,
        uint256 minProfit,
        string calldata why
    ) external onlyRole(KEEPER_ROLE) whenNotPaused nonReentrant returns (uint256 profit) {
        uint256 musdBefore = idleAssets();
        uint256 btcBefore = btc.balanceOf(address(this));
        _redeem(musdIn);
        _swapBtcForMusd(pool, btc.balanceOf(address(this)) - btcBefore);
        uint256 musdAfter = idleAssets();
        if (musdAfter < musdBefore + minProfit || musdAfter <= musdBefore) revert NoProfit(musdBefore, musdAfter);
        profit = musdAfter - musdBefore;
        emit Decision("PEG_ARB", musdIn, profit, why);
    }

    /// @notice Above-peg defence: sell MUSD for the stablecoin, only when MUSD is worth $1 plus the premium or more.
    /// Adds MUSD where it's scarce, and can never lower the vault's dollar value.
    function pegSell(uint256 musdIn, address pool, string calldata why)
        external
        onlyRole(KEEPER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256 out)
    {
        out = _swapStable(pool, asset(), musdIn, musdIn * (BPS + minPremiumBps) / BPS);
        uint256 assets = totalAssets();
        if (stableAssets() * BPS > assets * stableCapBps) revert LimitBreached();
        if (idleAssets() * BPS < assets * minIdleBps) revert LimitBreached();
        emit Decision("PEG_SELL", musdIn, out, why);
    }

    /// @notice Below-peg defence: buy MUSD back with the stablecoin, only at $1 or cheaper.
    function pegBuy(uint256 stableIn, address pool, string calldata why)
        external
        onlyRole(KEEPER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256 out)
    {
        out = _swapStable(pool, address(stable), stableIn, stableIn * stableScale);
        emit Decision("PEG_BUY", stableIn, out, why);
    }

    /// @notice Turns the stablecoin back into MUSD to refill withdrawals, at most `maxSlippageBps` under $1.
    /// Reduces risk, so the guardian can call it too and pause doesn't block it.
    function unwindStable(uint256 stableIn, address pool, string calldata why) external nonReentrant returns (uint256 out) {
        _onlyKeeperOrGuardian();
        out = _swapStable(pool, address(stable), stableIn, stableIn * stableScale * (BPS - maxSlippageBps) / BPS);
        emit Decision("UNWIND", stableIn, out, why);
    }

    /// @notice Lets the keeper publish a decision that changes nothing, such as an AI veto.
    function note(string calldata why) external onlyRole(KEEPER_ROLE) {
        emit Decision("NOTE", 0, 0, why);
    }

    // ---------- admin (held by a timelock on live deployments) ----------

    function setLimits(uint16 _spCapBps, uint16 _minIdleBps, uint16 _maxSlippageBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_spCapBps + _minIdleBps > BPS || _maxSlippageBps > 1_000) revert LimitBreached();
        (spCapBps, minIdleBps, maxSlippageBps) = (_spCapBps, _minIdleBps, _maxSlippageBps);
        emit LimitsSet(_spCapBps, _minIdleBps, _maxSlippageBps);
    }

    function setStableLimits(uint16 _stableCapBps, uint16 _minPremiumBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_stableCapBps > 5_000 || _minPremiumBps < 10) revert LimitBreached();
        (stableCapBps, minPremiumBps) = (_stableCapBps, _minPremiumBps);
        emit StableLimitsSet(_stableCapBps, _minPremiumBps);
    }

    function setDepositCap(uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function setPool(address pool, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_isPair(pool, address(btc))) revert PoolNotAllowed();
        isPool[pool] = allowed;
        emit PoolSet(pool, allowed);
    }

    function setStablePool(address pool, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_isPair(pool, address(stable))) revert PoolNotAllowed();
        isStablePool[pool] = allowed;
        emit PoolSet(pool, allowed);
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    // ---------- internal ----------

    function _onlyKeeperOrGuardian() internal view {
        if (!hasRole(KEEPER_ROLE, msg.sender) && !hasRole(GUARDIAN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, KEEPER_ROLE);
        }
    }

    function _isPair(address pool, address other) internal view returns (bool) {
        (address t0, address t1) = (IPool(pool).token0(), IPool(pool).token1());
        return (t0 == asset() && t1 == other) || (t0 == other && t1 == asset());
    }

    /// @dev Hints are computed in the same transaction on purpose: Mezo's oracle moves every block, and a partial
    /// redemption is cancelled unless its hint matches the trove's new collateral ratio almost exactly.
    /// Redeems across up to 50 troves, and only the amount Mezo says it can redeem.
    function _redeem(uint256 musdIn) internal {
        (address first, uint256 nicr, uint256 truncated) = hintHelpers.getRedemptionHints(musdIn, priceFeed.fetchPrice(), 50);
        if (truncated == 0) revert NoProfit(0, 0);
        (address upper, address lower) = sortedTroves.findInsertPosition(nicr, first, first);
        troveManager.redeemCollateral(truncated, first, upper, lower, nicr, 50);
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

    /// @dev Swaps MUSD <-> stablecoin. `minOut18` is the least acceptable output, in 18 decimals.
    function _swapStable(address pool, address tokenIn, uint256 amountIn, uint256 minOut18) internal returns (uint256 out) {
        if (!isStablePool[pool]) revert PoolNotAllowed();
        IPool p = IPool(pool);
        out = p.getAmountOut(amountIn, tokenIn);
        uint256 out18 = tokenIn == asset() ? out * stableScale : out;
        if (out18 < minOut18) revert BadPrice(out18, minOut18);
        IERC20(tokenIn).safeTransfer(pool, amountIn);
        (uint256 a0, uint256 a1) = p.token0() == tokenIn ? (uint256(0), out) : (out, uint256(0));
        p.swap(a0, a1, address(this), "");
    }
}
