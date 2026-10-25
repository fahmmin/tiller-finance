import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vault address comes from the Hardhat deploy script's output.
const file = new URL("../contracts/deployments/mezotestnet.json", import.meta.url);
const deployment = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};

export default defineConfig({
  plugins: [react()],
  define: { __DEPLOYMENT__: JSON.stringify(deployment) },
});
