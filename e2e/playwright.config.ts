import { defineConfig } from "@playwright/test";

// Real MetaMask against Mezo Testnet: one worker, generous timeouts for block confirmations.
export default defineConfig({
  testDir: "./tests",
  // "demo" records the pitch-video demo (npx playwright test --project=demo); "e2e" is the regular test
  projects: [
    { name: "e2e", testIgnore: /demo.spec.ts/ },
    { name: "demo", testMatch: /demo.spec.ts/ },
  ],
  timeout: 300_000,
  expect: { timeout: 90_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
  webServer: { command: "npm --prefix ../app run dev -- --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
});
