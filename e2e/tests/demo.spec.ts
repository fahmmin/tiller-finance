// The Wave 2 walkthrough video, recorded with real MetaMask on Mezo testnet against the live site:
//   BASE_URL=https://tillerfinance.xyz npx playwright test --project=demo   →  e2e/demo/tiller-walkthrough.mp4
// Waits for MetaMask and block confirmations are cut out, so it stays fast. Moves 1 test MUSD in and back out.
import path from "node:path";
import { testWithSynpress } from "@synthetixio/synpress";
import { metaMaskFixtures } from "@synthetixio/synpress/playwright";
import walletSetup from "../wallet-setup/mezo.setup";
import { approveInMetaMask } from "./metamask";
import { caption, glide, point, startScreencast } from "./screencast";

// headless Chrome renders every frame; a headed window behind other windows stops painting and the video stalls
process.env.HEADLESS ??= "1";

const test = testWithSynpress(metaMaskFixtures(walletSetup));
const { expect } = test;
type Page = import("@playwright/test").Page;

const setSlider = (page: Page, value: number) =>
  page.locator(".slider input").evaluate((el: HTMLInputElement, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

test("record the walkthrough", async ({ context, page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(2500);
  const rec = await startScreencast(page, path.join("test-results", "demo-frames"));
  const side = (name: string) => page.locator(".side").getByRole("link", { name, exact: true }).click();

  /** Click the action button, confirm in MetaMask, wait for the receipt; the wait is cut from the video. */
  async function confirm() {
    const input = page.getByLabel("Amount of MUSD");
    for (let attempt = 1; ; attempt++) {
      await page.locator(".abtn.wide").click();
      rec.pause();
      await approveInMetaMask(context, /^Confirm$/);
      const done = await Promise.race([
        expect(input).toHaveValue("", { timeout: 90_000 }).then(() => "ok"),
        page.locator(".toast.error").waitFor({ timeout: 90_000 }).then(() => "error"),
      ]);
      rec.resume();
      if (done === "ok") return;
      if (attempt === 3) throw new Error(await page.locator(".toast.error").innerText());
      await page.waitForTimeout(4_000); // a transient RPC error: send again
    }
  }

  // ---- 1. what it is ----
  await caption(page, "Tiller Finance: MUSD savings on Mezo that earn by defending MUSD's $1 peg", 3200);
  await glide(page, "#why");
  await caption(page, "MUSD's floor only holds if someone buys it back under $1. Tiller makes every depositor that buyer.", 3200);
  await glide(page, "#yield");
  await page.mouse.wheel(0, 380);
  await page.waitForTimeout(600);
  await setSlider(page, 0.95);
  await point(page, ".trade-bars", 900);
  await caption(page, "MUSD at $0.95: redeem it with Mezo for $1 of BTC, sell the BTC back, keep the difference", 3000);
  await setSlider(page, 0.99);
  await caption(page, "At $0.99 there's no edge, so the vault waits. The contract refuses any losing trade.", 2600);

  // ---- 2. traction, in public ----
  rec.pause();
  await page.goto("/stats");
  await expect(page.locator(".sp-tile strong").first()).toHaveText(/^\d/);
  rec.resume();
  await caption(page, "Live stats: every number is read straight from Mezo testnet", 3000);
  await glide(page, ".sp-chart");
  await caption(page, "Value locked over time, from every deposit and withdrawal", 2400);

  // ---- 3. the app ----
  rec.pause();
  await page.goto("/app");
  await expect(page.locator(".alloc")).toBeVisible({ timeout: 60_000 });
  rec.resume();
  await point(page, ".alloc", 900);
  await caption(page, "Wave 2 vault: Stability Pool, mUSDC and ready cash, all inside hard limits", 2800);

  await side("Peg monitor");
  await page.waitForTimeout(1500);
  await point(page, ".gauge", 900);
  await caption(page, "Live right now: Mezo's MUSD/BTC pool is under the buyback line, so the vault can buy MUSD back", 3600);
  await caption(page, "Wave 2 defends both ways: above $1.005 it sells MUSD for mUSDC, at $1 or less it buys it back", 3600);

  // ---- 4. a new user's path ----
  await side("Earn");
  await caption(page, "New user? Connect MetaMask. The app adds Mezo Testnet for you.", 2200);
  await page.locator(".topbar").getByRole("button", { name: "Connect wallet" }).click();
  rec.pause();
  await approveInMetaMask(context, /^(Connect|Confirm|Approve|Switch network)$/);
  await expect(page.locator(".banner.warn")).toHaveCount(0, { timeout: 20_000 });
  rec.resume();
  await point(page, ".faucet", 900);
  await caption(page, "No MUSD yet? One click gets 100 test MUSD plus BTC for gas. No trove, no setup.", 3200);

  const input = page.getByLabel("Amount of MUSD");
  await input.click();
  await input.pressSequentially("1", { delay: 120 });
  const action = page.locator(".abtn.wide");
  if ((await action.textContent()) === "Approve MUSD") {
    await action.click();
    rec.pause();
    await approveInMetaMask(context, /^(Next|Confirm|Approve)$/);
    await expect(page.locator(".toast.success")).toContainText("MUSD approved");
    rec.resume();
  }
  await caption(page, "Deposit 1 MUSD and confirm in MetaMask", 1500);
  await confirm();
  await caption(page, "Confirmed on Mezo. The toast links to the transaction.", 2200);

  // ---- 5. leaderboard + share ----
  await side("Peg Defenders");
  rec.pause();
  await expect(async () => {
    await page.reload();
    // stats take a few seconds to compute when the cache is cold
    await expect(page.locator(".lb .tr.me")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 150_000 });
  rec.resume();
  await point(page, ".dcard", 900);
  await caption(page, "Every depositor joins the Peg Defenders board and gets a card to share on X", 3200);
  await point(page, ".lb .tr.me", 900);

  // ---- 6. proof + safety ----
  await side("Activity");
  rec.pause(); // the decision log takes a while to read; cut the wait
  await expect(page.locator(".activity button.tr").first()).toBeVisible({ timeout: 120_000 });
  rec.resume();
  await page.locator(".activity button.tr", { hasText: "Bought back cheap MUSD" }).first().click();
  await point(page, ".tr-detail", 900);
  await caption(page, "Every move is on-chain with its reason. Claude reviews each one and can only veto.", 3200);

  await side("Risk & contracts");
  await page.waitForTimeout(1000);
  await point(page, ".rules", 900);
  await caption(page, "Hard limits: profit-only trades, mUSDC cap, sell floor, buy ceiling, deposit cap", 3200);
  await page.mouse.wheel(0, 500);
  await caption(page, "Admin changes wait in a public timelock. Withdrawals can never be paused.", 3000);

  // ---- 7. the way out ----
  await side("Earn");
  await page.getByRole("tab", { name: "Withdraw" }).click();
  await input.fill("1");
  await caption(page, "And the way out: withdraw any time", 1500);
  await confirm();

  await page.goto("/");
  await page.waitForTimeout(1200);
  await caption(page, "Try it: tillerfinance.xyz  ·  Telegram @tillerfinancebot  ·  github.com/fahmmin/tiller-finance", 4000);

  const frames = await rec(path.join("demo", "tiller-walkthrough.mp4"));
  console.log(`walkthrough: e2e/demo/tiller-walkthrough.mp4 (${frames} frames)`);
});
