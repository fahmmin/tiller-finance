// Borrows test MUSD for the demo: BTC_COLL=0.06 MUSD_DEBT=2000 npx hardhat run scripts/open-trove.js --network mezotestnet
const { ethers } = require("hardhat");
const { T } = require("./mezo");

async function main() {
  const [me] = await ethers.getSigners();
  const coll = ethers.parseEther(process.env.BTC_COLL || "0.06");
  const debt = ethers.parseEther(process.env.MUSD_DEBT || "2000");

  const bo = await ethers.getContractAt(["function openTrove(uint256,address,address) payable"], T.BorrowerOperations);
  const sorted = await ethers.getContractAt(["function findInsertPosition(uint256,address,address) view returns (address,address)"], T.SortedTroves);
  // NICR = coll * 1e20 / debt; debt here includes the 200 MUSD gas compensation
  const nicr = (coll * 10n ** 20n) / (debt + ethers.parseEther("200"));
  const [upper, lower] = await sorted.findInsertPosition(nicr, ethers.ZeroAddress, ethers.ZeroAddress);

  await (await bo.openTrove(debt, upper, lower, { value: coll })).wait();
  const musd = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], T.MUSD);
  console.log("MUSD balance", ethers.formatEther(await musd.balanceOf(me.address)));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
