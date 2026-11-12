// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Tiller testnet faucet
/// @notice Gives a new wallet enough test MUSD to try the vault, plus a little BTC for gas, once.
/// The operator (the site's backend) sends the drip, so a wallet with no BTC yet can still get started.
/// Testnet only: it holds borrowed test MUSD, never real funds.
contract TillerFaucet is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable musd;
    // On Mezo this ERC-20 precompile shares its balance with native BTC, so transferring it pays gas money.
    IERC20 public immutable btc;
    address public operator;
    uint256 public musdDrip = 100e18;
    uint256 public btcDrip = 0.00002e18;
    uint256 public claims;
    mapping(address => bool) public claimed;

    event Dripped(address indexed to, uint256 musd, uint256 btc);

    error NotOperator();
    error AlreadyClaimed();
    error Empty();

    constructor(IERC20 _musd, IERC20 _btc, address _operator) Ownable(msg.sender) {
        (musd, btc, operator) = (_musd, _btc, _operator);
    }

    function drip(address to) external {
        if (msg.sender != operator && msg.sender != owner()) revert NotOperator();
        if (claimed[to]) revert AlreadyClaimed();
        if (musd.balanceOf(address(this)) < musdDrip) revert Empty();
        claimed[to] = true;
        claims++;
        musd.safeTransfer(to, musdDrip);
        // gas money is best effort: an empty BTC balance shouldn't block the MUSD
        uint256 b = btc.balanceOf(address(this)) >= btcDrip ? btcDrip : 0;
        if (b > 0) btc.safeTransfer(to, b);
        emit Dripped(to, musdDrip, b);
    }

    function setDrip(uint256 _musdDrip, uint256 _btcDrip) external onlyOwner {
        (musdDrip, btcDrip) = (_musdDrip, _btcDrip);
    }

    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
    }

    function withdraw(IERC20 token, uint256 amount) external onlyOwner {
        token.safeTransfer(msg.sender, amount);
    }
}
