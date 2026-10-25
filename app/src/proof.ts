// Results from the Oct 25, 2026 testnet run. Every figure links to a transaction anyone can check.
import { EXPLORER } from "./chain";

export const PROOF = {
  pegTrade: {
    tx: `${EXPLORER}/tx/0x092903187a0c792c4fe03a46482867826468a33321f5a1f82d13239274ea4450`,
    redeemed: 3.167,
    profit: 0.118,
    returnPct: 3.7, // 0.118 / 3.167
    priceBefore: 0.9505,
    priceAfter: 0.9572,
  },
  stabilityPool: {
    tx: `${EXPLORER}/tx/0xfd1d2fe94343dc0b6ffccc17db0c7b2682b6ce3e188b8663e36e071c9d192ca6`,
    amount: 240,
  },
  tests: 15, // 10 contract + 5 keeper
  mainnetMusd: 0.9926, // MUSD/BTC pool, Oct 25 2026
  wave1Entries: 44,
};

export const GITHUB = "https://github.com/fahmmin/tiller-finance";
