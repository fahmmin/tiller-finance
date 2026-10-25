import { createPublicClient, defineChain, http, parseAbi, parseAbiItem } from "viem";

declare const __DEPLOYMENT__: {
  TillerVault?: `0x${string}`;
  DrillPool?: `0x${string}`;
  deployBlock?: number;
  previousVaults?: { address: `0x${string}`; deployBlock: number }[];
  keeper?: `0x${string}`;
};

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
});

export const EXPLORER = "https://explorer.test.mezo.org";
export const VAULT = __DEPLOYMENT__.TillerVault;
// Earlier testnet versions of the vault, so the log keeps their decisions.
export const PREVIOUS_VAULTS = (__DEPLOYMENT__.previousVaults ?? []).map((v) => v.address);
export const DEPLOY_BLOCK = BigInt(Math.min(__DEPLOYMENT__.deployBlock ?? 0, ...(__DEPLOYMENT__.previousVaults ?? []).map((v) => v.deployBlock)));
export const MUSD = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as const;
export const BTC = "0x7b7c000000000000000000000000000000000000" as const;
export const PRICE_FEED = "0x86bCF0841622a5dAC14A313a15f96A95421b9366" as const;

export const POOLS = [
  { address: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9" as `0x${string}`, label: "Mezo Pools MUSD/BTC" },
  ...(__DEPLOYMENT__.DrillPool ? [{ address: __DEPLOYMENT__.DrillPool, label: "Depeg drill pool (testnet)" }] : []),
];

export const vaultAbi = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function idleAssets() view returns (uint256)",
  "function pendingBtc() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function maxWithdraw(address) view returns (uint256)",
  "function spCapBps() view returns (uint16)",
  "function minIdleBps() view returns (uint16)",
  "function paused() view returns (bool)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
]);
export const decisionEvent = parseAbiItem("event Decision(bytes32 indexed action, uint256 amount, uint256 result, string why)");
export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
export const mezoAbi = parseAbi([
  "function fetchPrice() view returns (uint256)",
  "function getAmountOut(uint256,address) view returns (uint256)",
]);

export const pub = createPublicClient({ chain: mezoTestnet, transport: http() });

export const fmt = (x: bigint | undefined, dp = 2) =>
  x === undefined ? "–" : (Number(x) / 1e18).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const KEEPER = __DEPLOYMENT__.keeper;
export const DRILL_POOL = __DEPLOYMENT__.DrillPool;

// Mezo testnet contracts the vault calls (docs/mezo-reference.md)
export const MEZO_CONTRACTS = [
  { name: "MUSD", address: MUSD },
  { name: "Stability Pool", address: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e" },
  { name: "Trove Manager", address: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0" },
  { name: "Hint Helpers", address: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6" },
  { name: "Price Feed", address: PRICE_FEED },
  { name: "Mezo Pools MUSD/BTC", address: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9" },
] as const;
