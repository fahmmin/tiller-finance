// npx hardhat run scripts/withdraw-all.js --network mezotestnet  (VAULT=0x... to target an older vault)
const { ethers } = require("hardhat");
const { loadDeployment } = require("./mezo");

async function main() {
  const [me] = await ethers.getSigners();
  const vault = await ethers.getContractAt("TillerVault", process.env.VAULT || loadDeployment().TillerVault);
  const shares = await vault.balanceOf(me.address);
  if (shares > 0n) await (await vault.redeem(shares, me.address, me.address)).wait();
  console.log("redeemed", ethers.formatEther(shares), "tMUSD from", vault.target);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
