// AMOUNT=300 npx hardhat run scripts/deposit.js --network mezotestnet
const { ethers } = require("hardhat");
const { T, loadDeployment, ERC20 } = require("./mezo");

async function main() {
  const [me] = await ethers.getSigners();
  const vault = await ethers.getContractAt("TillerVault", loadDeployment().TillerVault);
  const amount = ethers.parseEther(process.env.AMOUNT || "300");
  await (await (await ethers.getContractAt(ERC20, T.MUSD)).approve(vault.target, amount)).wait();
  await (await vault.deposit(amount, me.address)).wait();
  console.log("deposited", ethers.formatEther(amount), "MUSD; vault total", ethers.formatEther(await vault.totalAssets()));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
