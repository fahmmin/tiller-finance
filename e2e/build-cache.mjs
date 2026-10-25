// Builds Synpress's MetaMask cache on Windows. Synpress's CLI refuses to start outside Linux/WSL by reading
// /proc/version; this answers that one check and then runs Synpress's own cache builder unchanged.
// shortcut: relies on Synpress internals (v4.1.2); on Linux/macOS/WSL just run `npx synpress wallet-setup`.
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// glob results must be forward-slash paths for tsup on Windows
const posixGlob = new URL("./glob-posix.mjs", import.meta.url).href;
registerHooks({
  resolve: (specifier, context, next) => {
    if (specifier === "glob" && context.parentURL?.includes("synpress-cache")) return next(posixGlob, context);
    // Synpress import()s compiled setup files by raw path; Windows needs a file:// URL
    if (/^[a-zA-Z]:[\\/]/.test(specifier)) return next(pathToFileURL(specifier).href, context);
    return next(specifier, context);
  },
});

// glob patterns need forward slashes even on Windows
const join = path.join;
path.join = (...parts) => { const p = join(...parts); return p.includes("*") ? p.replaceAll("\\", "/") : p; };

const read = fs.readFileSync;
fs.readFileSync = (p, ...rest) => (p === "/proc/version" ? "Linux version (Microsoft WSL shim for Windows)" : read(p, ...rest));

const { cliEntrypoint } = await import("@synthetixio/synpress-cache");
process.argv = [process.argv[0], "synpress", "wallet-setup", ...process.argv.slice(2)];
await cliEntrypoint();
