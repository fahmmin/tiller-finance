// npx hardhat run scripts/deploy.js --network mezotestnet   (or mezomainnet)
// Deploys the vault, sets it up, then hands admin to a timelock. The deployer stays guardian, so pausing is instant.
const { ethers, network } = require("hardhat");
const { T, saveDeployment } = require("./mezo");

const mainnet = network.name === "mezomainnet";
const CAP = ethers.parseEther(process.env.DEPOSIT_CAP || (mainnet ? "5000" : "100000"));
const DELAY = Number(process.env.TIMELOCK_DELAY || (mainnet ? 2 * 24 * 3600 : 3600)); // seconds

async function main() {
  const [deployer] = await ethers.getSigners();
  const keeper = process.env.KEEPER_ADDRESS || deployer.address;
  console.log(network.name, "deployer", deployer.address, "BTC", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const vault = await ethers.deployContract("TillerVault", [T.MUSD, T.StabilityPool, T.TroveManager, T.HintHelpers, T.SortedTroves, T.PriceFeed, T.BTC, T.mUSDC, CAP, deployer.address]);
  await vault.waitForDeployment();
  console.log("TillerVault", vault.target, "cap", ethers.formatEther(CAP), "MUSD");

  await (await vault.grantRole(await vault.KEEPER_ROLE(), keeper)).wait();
  await (await vault.setPool(T.MusdBtcPool, true)).wait();
  await (await vault.setStablePool(T.MusdUsdcPool, true)).wait();
  // testnet only: let the depeg drill pool stay usable for rehearsals
  if (!mainnet && process.env.DRILL_POOL) await (await vault.setPool(process.env.DRILL_POOL, true)).wait();

  // Any limit, pool or cap change now waits DELAY seconds in public view before it can run.
  const timelock = await ethers.deployContract("TimelockController", [DELAY, [deployer.address], [deployer.address], ethers.ZeroAddress]);
  await timelock.waitForDeployment();
  const ADMIN = await vault.DEFAULT_ADMIN_ROLE();
  await (await vault.grantRole(ADMIN, timelock.target)).wait();
  await (await vault.renounceRole(ADMIN, deployer.address)).wait();
  console.log("Timelock", timelock.target, "delay", DELAY, "s; deployer keeps GUARDIAN_ROLE");

  saveDeployment({ TillerVault: vault.target, Timelock: timelock.target, keeper, deployBlock: await ethers.provider.getBlockNumber() });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
