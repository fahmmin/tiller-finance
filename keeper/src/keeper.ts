// node --env-file=../.env src/keeper.ts [--once] [--dry]
import fs from "node:fs";
import { tick } from "./tick.ts";

const once = process.argv.includes("--once");
const dry = process.argv.includes("--dry");
const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MIN ?? 10) * 60_000;

do {
  await tick({ dry, record: (line) => fs.appendFileSync("decisions.jsonl", line + "\n") }).catch((e) => console.error("tick failed:", e));
  if (!once) await new Promise((r) => setTimeout(r, INTERVAL_MS));
} while (!once);
