// Sets up the depeg drill pool below $1 and whitelists it. Re-running tops up the existing pool.
// SWAP_MUSD=500 DRILL_BTC=0.011 DRILL_DISCOUNT_BPS=500 npx hardhat run scripts/drill.js --network mezotestnet
//   SWAP_MUSD   optional: first buy BTC with this much MUSD on Mezo's MUSD/BTC pool
//   DRILL_BTC   BTC to add to the drill pool
//   DRILL_DISCOUNT_BPS  how far under $1 the drill prices MUSD (500 = $0.95)
const { ethers } = require("hardhat");
const { T, loadDeployment, saveDeployment, ERC20 } = require("./mezo");

const POOL_ABI = [
  "function getAmountOut(uint256,address) view returns (uint256)",
  "function swap(uint256,uint256,address,bytes)",
  "function reserve0() view returns (uint256)",
  "function reserve1() view returns (uint256)",
  "function sync()",
];

async function main() {
  const [me] = await ethers.getSigners();
  const { TillerVault, DrillPool } = loadDeployment();
  if (!TillerVault) throw new Error("run scripts/deploy.js first");
  const musd = await ethers.getContractAt(ERC20, T.MUSD);
  const btc = await ethers.getContractAt(ERC20, T.BTC);

  if (process.env.SWAP_MUSD) {
    // Mezo pool: token0 = MUSD, token1 = BTC
    const amount = ethers.parseEther(process.env.SWAP_MUSD);
    const mezoPool = await ethers.getContractAt(POOL_ABI, T.MusdBtcPool);
    const out = await mezoPool.getAmountOut(amount, T.MUSD);
    await (await musd.transfer(T.MusdBtcPool, amount)).wait();
    await (await mezoPool.swap(0, out, me.address, "0x")).wait();
    console.log("bought", ethers.formatEther(out), "BTC for", process.env.SWAP_MUSD, "MUSD");
  }

  const pool = DrillPool
    ? await ethers.getContractAt(POOL_ABI, DrillPool)
    : await (await ethers.deployContract("DrillPool", [T.MUSD, T.BTC])).waitForDeployment();
  const poolAddress = await pool.getAddress();

  // target: MUSD per BTC = oracle / (1 - discount), so MUSD trades under $1
  const discountBps = BigInt(process.env.DRILL_DISCOUNT_BPS || "500");
  const price = await (await ethers.getContractAt(["function fetchPrice() view returns (uint256)"], T.PriceFeed)).fetchPrice();
  const btcIn = ethers.parseEther(process.env.DRILL_BTC || "0.005");
  const [musdNow, btcNow] = [await pool.reserve0(), await pool.reserve1()];
  const btcTarget = btcNow + btcIn;
  const musdTarget = (btcTarget * price * 10_000n) / ((10_000n - discountBps) * 10n ** 18n);
  const musdIn = musdTarget > musdNow ? musdTarget - musdNow : 0n;

  await (await musd.transfer(poolAddress, musdIn)).wait();
  await (await btc.transfer(poolAddress, btcIn)).wait();
  await (await pool.sync()).wait();

  const vault = await ethers.getContractAt("TillerVault", TillerVault);
  if (!(await vault.isPool(poolAddress))) await (await vault.setPool(poolAddress, true)).wait();
  saveDeployment({ DrillPool: poolAddress });
  console.log("DrillPool", poolAddress, "now", ethers.formatEther(await pool.reserve0()), "MUSD +", ethers.formatEther(await pool.reserve1()), "BTC");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
