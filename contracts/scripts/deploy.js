// npx hardhat run scripts/deploy.js --network mezotestnet
const { ethers } = require("hardhat");
const { T, saveDeployment } = require("./mezo");

async function main() {
  const [deployer] = await ethers.getSigners();
  const keeper = process.env.KEEPER_ADDRESS || deployer.address;
  console.log("deployer", deployer.address, "BTC", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const vault = await ethers.deployContract("TillerVault", [T.MUSD, T.StabilityPool, T.TroveManager, T.HintHelpers, T.SortedTroves, T.PriceFeed, T.BTC, deployer.address]);
  await vault.waitForDeployment();
  console.log("TillerVault", vault.target);

  await (await vault.grantRole(await vault.KEEPER_ROLE(), keeper)).wait();
  await (await vault.setPool(T.MusdBtcPool, true)).wait();
  saveDeployment({ TillerVault: vault.target, keeper, deployBlock: await ethers.provider.getBlockNumber() });
  console.log("keeper", keeper, "- whitelisted Mezo MUSD/BTC pool", T.MusdBtcPool);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
