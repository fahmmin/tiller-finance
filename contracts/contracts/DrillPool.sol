// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Depeg drill: a tiny constant-product pool (0.3% fee) with the same interface as a Mezo basic pool.
/// Mezo testnet MUSD trades above $1, so the demo seeds this pool below peg to show peg arbitrage.
/// Never used on mainnet, where the vault only whitelists real Mezo pools.
contract DrillPool {
    address public token0;
    address public token1;
    uint256 public reserve0;
    uint256 public reserve1;

    constructor(address t0, address t1) {
        (token0, token1) = (t0, t1);
    }

    function sync() external {
        reserve0 = ERC20(token0).balanceOf(address(this));
        reserve1 = ERC20(token1).balanceOf(address(this));
    }

    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256) {
        (uint256 rIn, uint256 rOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 inFee = amountIn * 997 / 1000;
        return inFee * rOut / (rIn + inFee);
    }

    function swap(uint256 a0, uint256 a1, address to, bytes calldata) external {
        if (a0 > 0) ERC20(token0).transfer(to, a0);
        if (a1 > 0) ERC20(token1).transfer(to, a1);
        uint256 b0 = ERC20(token0).balanceOf(address(this));
        uint256 b1 = ERC20(token1).balanceOf(address(this));
        require(b0 * b1 >= reserve0 * reserve1, "K");
        (reserve0, reserve1) = (b0, b1);
    }
}
