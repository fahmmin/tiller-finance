// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Test doubles for the Mezo contracts TillerVault talks to. Not deployed to any network.

contract MockToken is ERC20 {
    constructor(string memory s) ERC20(s, s) {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function burn(address from, uint256 a) external {
        _burn(from, a);
    }
}

contract MockPriceFeed {
    uint256 public fetchPrice;

    function set(uint256 p) external {
        fetchPrice = p;
    }
}

contract MockStabilityPool {
    MockToken public musd;
    MockToken public btc;
    mapping(address => uint256) public getCompoundedMUSDDeposit;
    mapping(address => uint256) public getDepositorCollateralGain;

    constructor(MockToken _musd, MockToken _btc) {
        (musd, btc) = (_musd, _btc);
    }

    function provideToSP(uint256 a) external {
        _payGain(msg.sender);
        musd.transferFrom(msg.sender, address(this), a);
        getCompoundedMUSDDeposit[msg.sender] += a;
    }

    function withdrawFromSP(uint256 a) external {
        _payGain(msg.sender);
        uint256 dep = getCompoundedMUSDDeposit[msg.sender];
        uint256 w = a < dep ? a : dep;
        getCompoundedMUSDDeposit[msg.sender] = dep - w;
        musd.transfer(msg.sender, w);
    }

    // Simulates a liquidation absorbed by `who`: MUSD burned, BTC gained.
    function liquidate(address who, uint256 musdLoss, uint256 btcGain) external {
        getCompoundedMUSDDeposit[who] -= musdLoss;
        musd.burn(address(this), musdLoss);
        btc.mint(address(this), btcGain);
        getDepositorCollateralGain[who] += btcGain;
    }

    function _payGain(address who) internal {
        uint256 g = getDepositorCollateralGain[who];
        getDepositorCollateralGain[who] = 0;
        if (g > 0) btc.transfer(who, g);
    }
}

contract MockTroveManager {
    MockToken public musd;
    MockToken public btc;
    MockPriceFeed public feed;

    constructor(MockToken _musd, MockToken _btc, MockPriceFeed _feed) {
        (musd, btc, feed) = (_musd, _btc, _feed);
    }

    // $1 of BTC per MUSD, minus Mezo's 0.75% redemption fee.
    function redeemCollateral(uint256 a, address, address, address, uint256, uint256) external {
        musd.burn(msg.sender, a);
        uint256 coll = a * 1e18 / feed.fetchPrice();
        btc.mint(msg.sender, coll - coll * 75 / 10_000);
    }
}

contract MockHintHelpers {
    function getRedemptionHints(uint256 a, uint256, uint256) external pure returns (address, uint256, uint256) {
        return (address(0), 0, a);
    }
}

contract MockSortedTroves {
    function findInsertPosition(uint256, address, address) external pure returns (address, address) {
        return (address(0), address(0));
    }
}
