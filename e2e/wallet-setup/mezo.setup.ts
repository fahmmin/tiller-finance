// MetaMask for the end-to-end test: import the testnet-only E2E wallet from ../.env. The app itself adds
// Mezo Testnet when the test connects, which exercises its add-and-switch-network flow.
// Never point this at a wallet with real funds. Fund it with contracts/scripts/fund.js.
import { defineWalletSetup } from "@synthetixio/synpress";
import { MetaMask } from "@synthetixio/synpress/playwright";
import dotenv from "dotenv";

const PASSWORD = "Tiller-e2e-only-1";

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  dotenv.config({ path: "../.env" });
  const metamask = new MetaMask(context, walletPage, PASSWORD);
  await metamask.importWallet(process.env.E2E_MNEMONIC!);
  // MetaMask 13 ends onboarding on a "Your wallet is ready" page that Synpress 4.1.2 doesn't click through
  const open = walletPage.getByRole("button", { name: "Open wallet" });
  if (await open.isVisible().catch(() => false)) await open.click();
  await walletPage.waitForURL((u) => !u.href.includes("onboarding"), { timeout: 20_000 }).catch(async () => {
    await walletPage.goto(walletPage.url().split("#")[0]); // home.html without the #onboarding route
  });
  await walletPage.waitForTimeout(4000);
  for (const name of ["Got it", "Not now", "No thanks", "Close", "Done"]) {
    const b = walletPage.getByRole("button", { name, exact: true }).first();
    if (await b.isVisible().catch(() => false)) await b.click();
  }
});

export { PASSWORD };
