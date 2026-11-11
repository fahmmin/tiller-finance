// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Pulls OpenZeppelin's TimelockController into the build so scripts can deploy it as the vault's admin.
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
