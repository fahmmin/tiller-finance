// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Minimal slices of the Mezo MUSD system (github.com/mezo-org/musd) and Mezo Pools.

interface IStabilityPool {
    function provideToSP(uint256 _amount) external;
    function withdrawFromSP(uint256 _amount) external;
    function getCompoundedMUSDDeposit(address _depositor) external view returns (uint256);
    function getDepositorCollateralGain(address _depositor) external view returns (uint256);
}

interface ITroveManager {
    function redeemCollateral(
        uint256 _amount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations
    ) external;
}

interface IHintHelpers {
    function getRedemptionHints(uint256 _amount, uint256 _price, uint256 _maxIterations)
        external
        view
        returns (address firstRedemptionHint, uint256 partialRedemptionHintNICR, uint256 truncatedAmount);
}

interface ISortedTroves {
    function findInsertPosition(uint256 _NICR, address _prevId, address _nextId) external view returns (address, address);
}

interface IPriceFeed {
    // BTC/USD, 18 decimals
    function fetchPrice() external view returns (uint256);
}

// Aerodrome-style basic pool used by Mezo Pools
interface IPool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}
