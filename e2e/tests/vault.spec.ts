// Full depositor flow on Mezo Testnet with a real MetaMask: connect, approve, deposit, withdraw,
// then check the other app pages. Moves 1 test MUSD in and back out.
import { testWithSynpress } from "@synthetixio/synpress";
import { metaMaskFixtures } from "@synthetixio/synpress/playwright";
import walletSetup from "../wallet-setup/mezo.setup";
import { approveInMetaMask } from "./metamask";

const test = testWithSynpress(metaMaskFixtures(walletSetup));
const { expect } = test;

const balance = async (page: import("@playwright/test").Page) => {
  const text = (await page.locator(".amount-sub").textContent()) ?? "";
  return Number(text.replace(/[^0-9.]/g, ""));
};

test("depositor can connect, deposit and withdraw MUSD", async ({ context, page }) => {

  await page.goto("/app/earn");
  await expect(page.getByRole("heading", { name: "Earn", exact: true })).toBeVisible();

  // connect
  await page.locator(".topbar").getByRole("button", { name: "Connect wallet" }).click();
  // MetaMask asks to connect, then (in the same popup on MetaMask 13) to add and switch to Mezo Testnet
  const steps = await approveInMetaMask(context, /^(Connect|Confirm|Approve|Switch network)$/);
  // the wrong-network banner can flash until MetaMask's chainChanged event lands; only a lasting one needs another popup
  const settled = await expect(page.locator(".banner.warn")).toHaveCount(0, { timeout: 15_000 }).then(() => true, () => false);
  if (!settled) steps.push(...(await approveInMetaMask(context, /^(Approve|Switch network|Confirm)$/, 20_000)));
  console.log("MetaMask connect steps:", steps.join(" → "));
  await expect(page.locator(".acct-btn")).toContainText("0xd126");
  await expect(page.locator(".amount-sub")).toContainText("Wallet balance");
  await expect(page.locator(".banner.warn")).toHaveCount(0); // on Mezo Testnet, no wrong-network banner
  const before = await balance(page);
  expect(before).toBeGreaterThanOrEqual(1);

  // input validation
  const input = page.getByLabel("Amount of MUSD");
  const action = page.locator(".abtn.wide");
  await input.fill("abc");
  await expect(action).toHaveText("Enter a valid amount");
  await input.fill(String(Math.ceil(before) + 1000));
  await expect(action).toHaveText("Not enough MUSD in your wallet");

  // approve if needed, then deposit 1 MUSD
  await input.fill("1");
  if ((await action.textContent()) === "Approve MUSD") {
    await action.click();
    await approveInMetaMask(context, /^(Next|Confirm|Approve)$/);
    await expect(page.locator(".toast.success")).toContainText("MUSD approved");
  }
  await expect(action).toHaveText("Deposit 1 MUSD");
  await action.click();
  await approveInMetaMask(context, /^Confirm$/);
  await expect(page.locator(".toast.success")).toContainText("Deposited 1 MUSD");
  await expect.poll(() => balance(page)).toBeCloseTo(before - 1, 2);

  // withdraw the same 1 MUSD
  await page.getByRole("tab", { name: "Withdraw" }).click();
  await expect(page).toHaveURL(/tab=withdraw/);
  await input.fill("1");
  await expect(action).toHaveText("Withdraw 1 MUSD");
  await action.click();
  await approveInMetaMask(context, /^Confirm$/);
  await expect(page.locator(".toast.success")).toContainText("Withdrew 1 MUSD");
  await page.getByRole("tab", { name: "Deposit" }).click();
  await expect.poll(() => balance(page)).toBeCloseTo(before, 2);

  // the other pages render live data
  await page.locator(".side").getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".position")).toContainText("Your deposit");
  await page.locator(".side").getByRole("link", { name: "Activity" }).click();
  await expect(page.locator(".activity button.tr").first()).toBeVisible();
  await page.locator(".side").getByRole("link", { name: "Peg monitor" }).click();
  await expect(page.locator(".tr .pool-name").first()).toBeVisible();
  await page.locator(".side").getByRole("link", { name: "Risk & contracts" }).click();
  await expect(page.locator(".rule-value").first()).toHaveText("80%");
});
