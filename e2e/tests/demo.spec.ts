// The live-demo part of the pitch video, recorded with real MetaMask on Mezo testnet:
//   npx playwright test --project=demo   →  e2e/demo/tiller-demo.mp4
// Re-record it yourself by following the captions. Moves 1 test MUSD in and back out.
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

/**
 * Clicks the action button, confirms in MetaMask, and waits for the amount box to clear (the app clears it only
 * after a confirmed receipt). Retries when MetaMask or the testnet RPC returns a transient "Internal JSON-RPC error".
 */
async function sendAndConfirm(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext) {
  const input = page.getByLabel("Amount of MUSD");
  for (let attempt = 1; ; attempt++) {
    await page.locator(".abtn.wide").click();
    await approveInMetaMask(context, /^Confirm$/);
    const done = await Promise.race([
      expect(input).toHaveValue("", { timeout: 90_000 }).then(() => "ok"),
      page.locator(".toast.error").waitFor({ timeout: 90_000 }).then(() => "error"),
    ]);
    if (done === "ok") return;
    if (attempt === 3) throw new Error(await page.locator(".toast.error").innerText());
    await page.waitForTimeout(4_000); // let the RPC settle, then send again
  }
}

const setSlider = (page: import("@playwright/test").Page, value: number) =>
  page.locator(".slider input").evaluate((el: HTMLInputElement, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

test("record the live demo", async ({ context, page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(1500);
  const stop = await startScreencast(page, path.join("test-results", "demo-frames"));

  // ---- landing: what it is and how it earns ----
  await caption(page, "Tiller Finance: a MUSD savings vault on Mezo that earns by defending MUSD's $1 peg", 4000);
  await glide(page, "#why");
  await caption(page, "MUSD's floor holds only if someone buys it back under $1. Tiller does that for every depositor.", 3500);
  await glide(page, "#yield");
  await page.mouse.wheel(0, 380);
  await page.waitForTimeout(800);
  await caption(page, "Job 1: buy dollars on sale. If MUSD sells for $0.95…", 1500);
  await setSlider(page, 0.95);
  await point(page, ".trade-bars");
  await caption(page, "…redeem 1,000 MUSD at Mezo for $1 of BTC each, sell the BTC back: +41.6 MUSD", 3000);
  await setSlider(page, 0.99);
  await point(page, ".verdict");
  await caption(page, "At $0.99 there's no profit, so the vault waits. The contract refuses losing trades.", 3000);
  await setSlider(page, 0.95);

  // ---- app: connect and deposit ----
  await caption(page, "Now the app, live on Mezo testnet", 1500);
  await page.goto("/app/earn");
  await expect(page.getByRole("heading", { name: "Earn", exact: true })).toBeVisible();
  await caption(page, "Connect MetaMask. The app adds and switches to Mezo Testnet for you.", 2000);
  await page.locator(".topbar").getByRole("button", { name: "Connect wallet" }).click();
  await approveInMetaMask(context, /^(Connect|Confirm|Approve|Switch network)$/);
  await expect(page.locator(".banner.warn")).toHaveCount(0, { timeout: 20_000 });
  await point(page, ".acct-btn");

  const input = page.getByLabel("Amount of MUSD");
  const action = page.locator(".abtn.wide");
  await input.click();
  await input.pressSequentially("1", { delay: 200 });
  await caption(page, "Deposit 1 MUSD. The button always names the next step.", 2000);
  if ((await action.textContent()) === "Approve MUSD") {
    await action.click();
    await approveInMetaMask(context, /^(Next|Confirm|Approve)$/);
    await expect(page.locator(".toast.success")).toContainText("MUSD approved");
  }
  await caption(page, "Confirm in MetaMask…", 500);
  await sendAndConfirm(page, context);
  await caption(page, "Confirmed on Mezo: 1 MUSD in the vault, and the toast links to the transaction.", 2500);

  // ---- app: proof pages ----
  await page.locator(".side").getByRole("link", { name: "Peg monitor" }).click();
  await page.waitForTimeout(1500);
  await point(page, ".gauge");
  await caption(page, "Live MUSD price per pool. Mezo's pool is above $1, so the vault waits; the testnet drill pool is below $1.", 4000);

  await page.locator(".side").getByRole("link", { name: "Activity" }).click();
  await expect(page.locator(".activity button.tr").first()).toBeVisible();
  await page.locator(".activity button.tr", { hasText: "Bought back cheap MUSD" }).click();
  await point(page, ".tr-detail");
  await caption(page, "The first live peg trade: +0.118 MUSD. Claude approved it, and its reason is written on-chain.", 4000);

  await page.locator(".side").getByRole("link", { name: "Risk & contracts" }).click();
  await page.waitForTimeout(1200);
  await point(page, ".rules");
  await caption(page, "Hard limits in the contract. Claude can only veto, and withdrawals can never be paused.", 3500);

  // ---- withdraw, to show the way out ----
  await page.locator(".side").getByRole("link", { name: "Earn" }).click();
  await page.getByRole("tab", { name: "Withdraw" }).click();
  await page.locator(".max").click(); // everything back out, so the test wallet ends where it started
  await caption(page, "And the way out: withdraw any time.", 1500);
  await sendAndConfirm(page, context);
  await caption(page, "tillerfinance.xyz  ·  github.com/fahmmin/tiller-finance", 3500);

  const frames = await stop(path.join("demo", "tiller-demo.mp4"));
  console.log(`demo video: e2e/demo/tiller-demo.mp4 (${frames} frames)`);
});
