// npx hardhat run scripts/deploy-faucet.js --network mezotestnet
// The keeper wallet is the operator: the site's backend sends drips with it.
const { ethers } = require("hardhat");
const { T, saveDeployment } = require("./mezo");

async function main() {
  const [deployer] = await ethers.getSigners();
  const operator = process.env.KEEPER_ADDRESS || deployer.address;
  const faucet = await ethers.deployContract("TillerFaucet", [T.MUSD, T.BTC, operator]);
  await faucet.waitForDeployment();
  saveDeployment({ TillerFaucet: faucet.target });
  console.log("TillerFaucet", faucet.target, "operator", operator);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
