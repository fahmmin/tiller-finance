const { expect } = require("chai");
const { ethers } = require("hardhat");

const e = (n) => ethers.parseEther(String(n));

describe("TillerVault", () => {
  let musd, btc, usdc, feed, sp, tm, hh, vault, admin, keeper, alice;

  // Pool priced at `musdPerBtc`; above the 80k oracle price means MUSD trades under $1.
  async function pool(musdPerBtc) {
    const p = await ethers.deployContract("DrillPool", [musd.target, btc.target]);
    await musd.mint(p.target, e(10 * musdPerBtc));
    await btc.mint(p.target, e(10));
    await p.sync();
    await vault.setPool(p.target, true);
    return p;
  }

  // MUSD/mUSDC pool where 1 MUSD buys about `usdPerMusd` mUSDC (6 decimals).
  async function stablePool(usdPerMusd) {
    const p = await ethers.deployContract("DrillPool", [musd.target, usdc.target]);
    await musd.mint(p.target, e(1_000_000));
    await usdc.mint(p.target, BigInt(Math.round(1_000_000 * usdPerMusd)) * 10n ** 6n);
    await p.sync();
    await vault.setStablePool(p.target, true);
    return p;
  }

  beforeEach(async () => {
    [admin, keeper, alice] = await ethers.getSigners();
    musd = await ethers.deployContract("MockToken", ["MUSD"]);
    btc = await ethers.deployContract("MockToken", ["BTC"]);
    usdc = await ethers.deployContract("MockStable");
    feed = await ethers.deployContract("MockPriceFeed");
    await feed.set(e(80_000));
    sp = await ethers.deployContract("MockStabilityPool", [musd.target, btc.target]);
    tm = await ethers.deployContract("MockTroveManager", [musd.target, btc.target, feed.target]);
    hh = await ethers.deployContract("MockHintHelpers");
    const st = await ethers.deployContract("MockSortedTroves");
    vault = await ethers.deployContract("TillerVault", [musd.target, sp.target, tm.target, hh.target, st.target, feed.target, btc.target, usdc.target, e(1_000_000), admin.address]);
    await vault.grantRole(await vault.KEEPER_ROLE(), keeper.address);

    await musd.mint(alice.address, e(10_000));
    await musd.connect(alice).approve(vault.target, ethers.MaxUint256);
    await vault.connect(alice).deposit(e(10_000), alice.address);
  });

  it("counts Stability Pool deposits in totalAssets", async () => {
    await vault.connect(keeper).depositToStabilityPool(e(8_000), "test");
    expect(await vault.idleAssets()).to.equal(e(2_000));
    expect(await vault.totalAssets()).to.equal(e(10_000));
  });

  it("enforces the Stability Pool cap and idle buffer", async () => {
    await expect(vault.connect(keeper).depositToStabilityPool(e(8_001), "too much"))
      .to.be.revertedWithCustomError(vault, "LimitBreached");
    await vault.setLimits(9_500, 500, 150);
    await expect(vault.connect(keeper).depositToStabilityPool(e(9_600), "breaks buffer"))
      .to.be.revertedWithCustomError(vault, "LimitBreached");
  });

  it("only lets the keeper act", async () => {
    await expect(vault.connect(alice).depositToStabilityPool(e(1), "x"))
      .to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    await expect(vault.connect(alice).note("x")).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
  });

  it("pulls from the Stability Pool when a withdrawal exceeds the idle buffer", async () => {
    await vault.connect(keeper).depositToStabilityPool(e(8_000), "test");
    await vault.connect(alice).withdraw(e(9_000), alice.address, alice.address);
    expect(await musd.balanceOf(alice.address)).to.equal(e(9_000));
    expect(await vault.totalAssets()).to.equal(e(1_000));
  });

  it("makes a profit on peg arbitrage when MUSD trades under $1", async () => {
    const p = await pool(82_000); // MUSD ~ $0.976
    const before = await vault.totalAssets();
    await expect(vault.connect(keeper).pegArb(e(1_000), p.target, 1, "MUSD at 0.976"))
      .to.emit(vault, "Decision");
    expect(await vault.totalAssets()).to.be.gt(before);
    expect(await btc.balanceOf(vault.target)).to.equal(0);
  });

  it("refuses peg arbitrage that would lose money", async () => {
    const p = await pool(79_500); // MUSD ~ $1.006
    await expect(vault.connect(keeper).pegArb(e(1_000), p.target, 0, "no edge"))
      .to.be.revertedWithCustomError(vault, "NoProfit");
  });

  it("refuses pools that are not whitelisted", async () => {
    const p = await ethers.deployContract("DrillPool", [musd.target, btc.target]);
    await expect(vault.connect(keeper).pegArb(e(1_000), p.target, 0, "x"))
      .to.be.revertedWithCustomError(vault, "PoolNotAllowed");
  });

  it("harvests liquidation BTC back into MUSD at near oracle value", async () => {
    const p = await pool(80_000);
    await vault.connect(keeper).depositToStabilityPool(e(8_000), "test");
    // liquidation: 1,000 MUSD absorbed for BTC worth ~$1,096
    await sp.liquidate(vault.target, e(1_000), e(0.0137));
    expect(await vault.totalAssets()).to.equal(e(9_000));
    await vault.connect(keeper).harvest(p.target, "claim BTC");
    expect(await vault.totalAssets()).to.be.gt(e(10_080));
  });

  it("blocks a harvest into a bad price", async () => {
    const p = await pool(70_000);
    await vault.connect(keeper).depositToStabilityPool(e(8_000), "test");
    await sp.liquidate(vault.target, e(1_000), e(0.0137));
    await expect(vault.connect(keeper).harvest(p.target, "x")).to.be.revertedWithCustomError(vault, "SlippageTooHigh");
  });

  it("pause stops new risk but never blocks withdrawals", async () => {
    await vault.connect(keeper).depositToStabilityPool(e(8_000), "test");
    await vault.pause();
    await expect(vault.connect(keeper).depositToStabilityPool(e(1), "x")).to.be.revertedWithCustomError(vault, "EnforcedPause");
    expect(await vault.maxDeposit(alice.address)).to.equal(0);
    await expect(vault.connect(alice).deposit(e(1), alice.address)).to.be.revertedWithCustomError(vault, "ERC4626ExceededMaxDeposit");
    await vault.connect(alice).redeem(await vault.balanceOf(alice.address), alice.address, alice.address);
    expect(await musd.balanceOf(alice.address)).to.equal(e(10_000));
  });

  it("redeems only what Mezo can redeem, across troves", async () => {
    const p = await pool(82_000);
    await hh.setCap(e(400));
    await vault.connect(keeper).pegArb(e(1_000), p.target, 1, "capped");
    // 400 MUSD redeemed, so 600 of the 1,000 MUSD idle stay untouched plus the profit
    expect(await vault.idleAssets()).to.be.gt(e(10_000)).and.lt(e(10_020));
  });

  it("caps total deposits", async () => {
    await vault.setDepositCap(e(10_500));
    expect(await vault.maxDeposit(alice.address)).to.equal(e(500));
    await musd.mint(alice.address, e(1_000));
    await expect(vault.connect(alice).deposit(e(501), alice.address))
      .to.be.revertedWithCustomError(vault, "ERC4626ExceededMaxDeposit");
    await vault.connect(alice).deposit(e(500), alice.address);
  });

  it("sells MUSD for mUSDC only above $1 plus the premium", async () => {
    const rich = await stablePool(1.02);
    const before = await vault.totalAssets();
    await vault.connect(keeper).pegSell(e(1_000), rich.target, "MUSD at 1.02");
    expect(await vault.totalAssets()).to.be.gt(before);
    expect(await vault.stableAssets()).to.be.gt(e(1_005));

    const flat = await stablePool(1.0);
    await expect(vault.connect(keeper).pegSell(e(1_000), flat.target, "no premium"))
      .to.be.revertedWithCustomError(vault, "BadPrice");
  });

  it("keeps the mUSDC sleeve under its cap", async () => {
    const rich = await stablePool(1.02);
    await expect(vault.connect(keeper).pegSell(e(3_500), rich.target, "too much"))
      .to.be.revertedWithCustomError(vault, "LimitBreached");
  });

  it("buys MUSD back with mUSDC only at $1 or cheaper", async () => {
    const rich = await stablePool(1.02);
    await vault.connect(keeper).pegSell(e(1_000), rich.target, "sell high");
    const held = await usdc.balanceOf(vault.target);

    const pricey = await stablePool(1.01); // MUSD still above $1: buying back now would lose
    await expect(vault.connect(keeper).pegBuy(held, pricey.target, "x")).to.be.revertedWithCustomError(vault, "BadPrice");

    const cheap = await stablePool(0.97);
    await vault.connect(keeper).pegBuy(held, cheap.target, "buy low");
    expect(await vault.stableAssets()).to.equal(0);
    expect(await vault.totalAssets()).to.be.gt(e(10_040)); // round trip earned the premium and the dip
  });

  it("limits withdrawals to liquid MUSD, and the guardian can unwind mUSDC while paused", async () => {
    const rich = await stablePool(1.02);
    await vault.connect(keeper).pegSell(e(2_000), rich.target, "sell high");
    const liquid = await vault.liquidAssets();
    expect(await vault.maxWithdraw(alice.address)).to.equal(liquid);
    await expect(vault.connect(alice).withdraw(liquid + 1n, alice.address, alice.address))
      .to.be.revertedWithCustomError(vault, "ERC4626ExceededMaxWithdraw");

    await vault.pause();
    const flat = await stablePool(1.0);
    await vault.unwindStable(await usdc.balanceOf(vault.target), flat.target, "refill withdrawals");
    await vault.connect(alice).redeem(await vault.balanceOf(alice.address), alice.address, alice.address);
    expect(await musd.balanceOf(alice.address)).to.be.gt(e(9_990));
  });
});
