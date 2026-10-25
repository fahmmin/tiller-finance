// Sends test BTC (gas) and test MUSD from the deployer to another testnet wallet, e.g. the e2e test wallet:
// TO=0x... BTC=0.0005 MUSD=5 npx hardhat run scripts/fund.js --network mezotestnet
const { ethers } = require("hardhat");
const { T, ERC20 } = require("./mezo");

async function main() {
  const [me] = await ethers.getSigners();
  const to = process.env.TO || process.env.E2E_ADDRESS;
  if (!to) throw new Error("set TO");
  await (await me.sendTransaction({ to, value: ethers.parseEther(process.env.BTC || "0.0005") })).wait();
  await (await (await ethers.getContractAt(ERC20, T.MUSD)).transfer(to, ethers.parseEther(process.env.MUSD || "5"))).wait();
  console.log("funded", to);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
