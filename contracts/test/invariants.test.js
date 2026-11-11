// Randomised invariant test: many seeded sequences of deposits, withdrawals, keeper moves, price moves and
// liquidations. After every step, the vault's promises must still hold.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const e = (n) => ethers.parseEther(String(n));
const SEEDS = Number(process.env.INVARIANT_SEEDS ?? 20);
const STEPS = Number(process.env.INVARIANT_STEPS ?? 40);

// mulberry32: small seeded PRNG so a failing seed can be replayed
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

async function fixture() {
  const [admin, keeper, alice, bob] = await ethers.getSigners();
  const musd = await ethers.deployContract("MockToken", ["MUSD"]);
  const btc = await ethers.deployContract("MockToken", ["BTC"]);
  const usdc = await ethers.deployContract("MockStable");
  const feed = await ethers.deployContract("MockPriceFeed");
  await feed.set(e(80_000));
  const sp = await ethers.deployContract("MockStabilityPool", [musd.target, btc.target]);
  const tm = await ethers.deployContract("MockTroveManager", [musd.target, btc.target, feed.target]);
  const hh = await ethers.deployContract("MockHintHelpers");
  const st = await ethers.deployContract("MockSortedTroves");
  const vault = await ethers.deployContract("TillerVault", [musd.target, sp.target, tm.target, hh.target, st.target, feed.target, btc.target, usdc.target, e(50_000), admin.address]);
  await vault.grantRole(await vault.KEEPER_ROLE(), keeper.address);

  const pair = async (t1, musdAmt, t1Amt, stable) => {
    const p = await ethers.deployContract("DrillPool", [musd.target, t1.target]);
    await musd.mint(p.target, musdAmt);
    await t1.mint(p.target, t1Amt);
    await p.sync();
    await (stable ? vault.setStablePool(p.target, true) : vault.setPool(p.target, true));
    return p;
  };
  const btcPool = await pair(btc, e(8_200_000), e(100), false); // MUSD ~ $0.976
  const richPool = await pair(usdc, e(1_000_000), 1_020_000n * 10n ** 6n, true); // MUSD ~ $1.02
  const cheapPool = await pair(usdc, e(1_000_000), 980_000n * 10n ** 6n, true); // MUSD ~ $0.98

  for (const u of [alice, bob]) {
    await musd.mint(u.address, e(30_000));
    await musd.connect(u).approve(vault.target, ethers.MaxUint256);
  }
  return { admin, keeper, users: [alice, bob], musd, usdc, feed, sp, vault, btcPool, richPool, cheapPool };
}

describe("TillerVault invariants", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`seed ${seed}: keeper moves never lower share price, caps hold, and everyone can exit`, async () => {
      const f = await loadFixture(fixture);
      const { vault, keeper, users } = f;
      const r = rng(seed);
      const pick = (xs) => xs[Math.floor(r() * xs.length)];
      const amount = (max) => (max * BigInt(Math.floor(r() * 1000) + 1)) / 1000n;
      const pps = async () => ((await vault.totalSupply()) === 0n ? e(1) : await vault.convertToAssets(e(1)));
      const tryTx = (p) => p.then((tx) => tx.wait().then(() => true), () => false);

      for (let i = 0; i < STEPS; i++) {
        const before = await pps();
        const u = pick(users);
        const step = pick(["deposit", "withdraw", "sp", "spOut", "arb", "sell", "buy", "liquidate", "harvest", "price", "pause"]);
        let keeperMove = true;
        let ok = false;
        switch (step) {
          case "deposit":
            keeperMove = false;
            ok = await tryTx(vault.connect(u).deposit(amount(e(5_000)), u.address));
            break;
          case "withdraw":
            keeperMove = false;
            ok = await tryTx(vault.connect(u).withdraw(amount(await vault.maxWithdraw(u.address)), u.address, u.address));
            break;
          case "sp":
            ok = await tryTx(vault.connect(keeper).depositToStabilityPool(amount(await vault.idleAssets()), "fuzz"));
            if (ok) expect((await f.sp.getCompoundedMUSDDeposit(vault.target)) * 10_000n).to.be.lte((await vault.totalAssets()) * 8_000n);
            break;
          case "spOut":
            ok = await tryTx(vault.connect(keeper).withdrawFromStabilityPool(amount(e(5_000)), "fuzz"));
            break;
          case "arb":
            ok = await tryTx(vault.connect(keeper).pegArb(amount(await vault.idleAssets()), f.btcPool.target, 0, "fuzz"));
            break;
          case "sell":
            ok = await tryTx(vault.connect(keeper).pegSell(amount(await vault.idleAssets()), f.richPool.target, "fuzz"));
            if (ok) expect((await vault.stableAssets()) * 10_000n).to.be.lte((await vault.totalAssets()) * 3_000n);
            break;
          case "buy":
            ok = await tryTx(vault.connect(keeper).pegBuy(amount(await f.usdc.balanceOf(vault.target)), f.cheapPool.target, "fuzz"));
            break;
          case "liquidate": {
            keeperMove = false; // a real loss until harvested
            const dep = await f.sp.getCompoundedMUSDDeposit(vault.target);
            if (dep > e(100)) {
              const loss = amount(dep / 10n);
              await f.sp.liquidate(vault.target, loss, (loss * 110n) / 100n / 80_000n);
            }
            break;
          }
          case "harvest":
            ok = await tryTx(vault.connect(keeper).harvest(f.btcPool.target, "fuzz"));
            break;
          case "price":
            keeperMove = false;
            await f.feed.set(e(76_000 + Math.floor(r() * 8_000)));
            break;
          case "pause":
            keeperMove = false;
            await ((await vault.paused()) ? vault.unpause() : vault.pause());
            break;
        }
        if (keeperMove && ok) expect(await pps(), `seed ${seed} step ${i} ${step}`).to.be.gte(before);
      }

      // everyone can always get out: unwind the sleeve if needed, then redeem every share, even while paused
      if (!(await vault.paused())) await vault.pause();
      const held = await f.usdc.balanceOf(vault.target);
      if (held > 0n) await vault.unwindStable(held, f.cheapPool.target, "exit");
      for (const u of users) {
        await vault.connect(u).redeem(await vault.balanceOf(u.address), u.address, u.address);
        expect(await vault.balanceOf(u.address)).to.equal(0);
      }
    });
  }
});
