// Tops up the testnet faucet by borrowing more MUSD against the deployer's trove.
// BTC_ADD=0.04 MUSD_OUT=1500 FAUCET_BTC=0.002 npx hardhat run scripts/fund-faucet.js --network mezotestnet
const { ethers } = require("hardhat");
const { T, loadDeployment, ERC20 } = require("./mezo");

async function main() {
  const [me] = await ethers.getSigners();
  const faucet = loadDeployment().TillerFaucet;
  const add = ethers.parseEther(process.env.BTC_ADD || "0");
  const out = ethers.parseEther(process.env.MUSD_OUT || "0");
  const faucetBtc = ethers.parseEther(process.env.FAUCET_BTC || "0");

  if (add > 0n || out > 0n) {
    const tm = await ethers.getContractAt(["function getEntireDebtAndColl(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)"], T.TroveManager);
    const [coll, principal, interest] = await tm.getEntireDebtAndColl(me.address);
    // NICR = coll * 1e20 / debt, for the trove after this change
    const nicr = ((coll + add) * 10n ** 20n) / (principal + interest + out);
    const sorted = await ethers.getContractAt(["function findInsertPosition(uint256,address,address) view returns (address,address)"], T.SortedTroves);
    const [upper, lower] = await sorted.findInsertPosition(nicr, ethers.ZeroAddress, ethers.ZeroAddress);
    const bo = await ethers.getContractAt(
      ["function addColl(address,address) payable", "function withdrawMUSD(uint256,address,address)"],
      T.BorrowerOperations,
    );
    if (add > 0n) await (await bo.addColl(upper, lower, { value: add })).wait();
    if (out > 0n) await (await bo.withdrawMUSD(out, upper, lower)).wait();
  }

  const musd = await ethers.getContractAt(ERC20, T.MUSD);
  const bal = await musd.balanceOf(me.address);
  if (bal > ethers.parseEther("1")) await (await musd.transfer(faucet, bal - ethers.parseEther("1"))).wait();
  // the faucet has no receive(), so BTC goes in through Mezo's ERC-20 precompile
  if (faucetBtc > 0n) await (await (await ethers.getContractAt(ERC20, T.BTC)).transfer(faucet, faucetBtc)).wait();
  console.log("faucet MUSD", ethers.formatEther(await musd.balanceOf(faucet)), "BTC", ethers.formatEther(await ethers.provider.getBalance(faucet)));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
