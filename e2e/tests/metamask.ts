// MetaMask popup handling by visible button labels. Synpress 4.1.2's helpers target older MetaMask screens;
// MetaMask 13 renamed and merged steps (one-step connect, single confirm screens), so we drive the popup directly.
import type { BrowserContext, Page } from "@playwright/test";

const isPopup = (p: Page) => p.url().startsWith("chrome-extension://") && p.url().includes("notification.html");

async function findPopup(context: BrowserContext, timeout: number): Promise<Page | undefined> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const popup = context.pages().find(isPopup);
    if (popup) return popup;
    await new Promise((r) => setTimeout(r, 400));
  }
}

/**
 * Clicks through every MetaMask popup screen whose primary button matches `labels`, until the popup closes.
 * Returns the labels it clicked, e.g. ["Approve", "Switch network"].
 */
export async function approveInMetaMask(context: BrowserContext, labels: RegExp, timeout = 60_000): Promise<string[]> {
  const clicked: string[] = [];
  const popup = await findPopup(context, timeout);
  if (!popup) throw new Error(`No MetaMask popup appeared within ${timeout / 1000}s`);
  const end = Date.now() + timeout;
  let idle = 0; // MetaMask may reuse the popup for the next request; stop once nothing here matches for a while
  while (!popup.isClosed() && Date.now() < end && !(clicked.length && idle >= 4)) {
    const button = popup.getByRole("button", { name: labels }).last();
    const ready = await button.isEnabled({ timeout: 2_000 }).catch(() => false);
    if (!ready) {
      idle++;
      await popup.waitForTimeout(500).catch(() => {});
      continue;
    }
    idle = 0;
    clicked.push(((await button.textContent()) ?? "").trim());
    await button.click().catch(() => {}); // the popup may close mid-click
    await popup.waitForTimeout(1_200).catch(() => {});
  }
  return clicked;
}
