const { expect } = require("chai");
const { ethers } = require("hardhat");

const e = (n) => ethers.parseEther(String(n));

describe("TillerFaucet", () => {
  let musd, btc, faucet, owner, operator, alice;

  beforeEach(async () => {
    [owner, operator, alice] = await ethers.getSigners();
    musd = await ethers.deployContract("MockToken", ["MUSD"]);
    btc = await ethers.deployContract("MockToken", ["BTC"]);
    faucet = await ethers.deployContract("TillerFaucet", [musd.target, btc.target, operator.address]);
    await musd.mint(faucet.target, e(250));
    await btc.mint(faucet.target, e(0.00003));
  });

  it("drips MUSD and gas money once per wallet, only for the operator", async () => {
    await expect(faucet.connect(alice).drip(alice.address)).to.be.revertedWithCustomError(faucet, "NotOperator");
    await faucet.connect(operator).drip(alice.address);
    expect(await musd.balanceOf(alice.address)).to.equal(e(100));
    expect(await btc.balanceOf(alice.address)).to.equal(e(0.00002));
    expect(await faucet.claims()).to.equal(1);
    await expect(faucet.connect(operator).drip(alice.address)).to.be.revertedWithCustomError(faucet, "AlreadyClaimed");
  });

  it("still drips MUSD when gas money runs out, and stops when MUSD runs out", async () => {
    const [, , , b, c, d] = await ethers.getSigners();
    await faucet.connect(operator).drip(b.address);
    await faucet.connect(operator).drip(c.address); // only 0.00001 BTC left: below the drip
    expect(await musd.balanceOf(c.address)).to.equal(e(100));
    expect(await btc.balanceOf(c.address)).to.equal(0);
    await expect(faucet.connect(operator).drip(d.address)).to.be.revertedWithCustomError(faucet, "Empty");
  });
});
