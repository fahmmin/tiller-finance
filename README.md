# Tiller Finance

**MUSD savings that make MUSD stronger.**

Tiller is a vault for MUSD, Mezo's Bitcoin-backed dollar. It earns by doing the job that keeps a stablecoin at $1: when MUSD trades cheap, the vault buys it back through Mezo's redemption mechanism and keeps the difference. Between depegs, it backs Mezo's Stability Pool. A rule-based keeper proposes every move, Claude reviews it and can stop it, and every reason is written on-chain.

**Live:** [tillerfinance.xyz](https://tillerfinance.xyz) · **Vault app:** [tillerfinance.xyz/app](https://tillerfinance.xyz/app) · **Code:** [github.com/fahmmin/tiller-finance](https://github.com/fahmmin/tiller-finance) · **Network:** Mezo testnet (chain 31611) · **Track:** Track 1, DeFi

---

## Results: tested on chain, not on slides

Run on Mezo testnet on **Oct 25, 2026**. Every row is a transaction anyone can open.

| What happened | Result | Proof |
|---|---|---|
| **Peg trade:** the vault redeemed 3.167 MUSD for $1 of BTC each through Mezo, then sold the BTC back in a pool pricing MUSD at $0.95 | **+0.118 MUSD profit, 3.7% on the trade**, in one transaction, approved by Claude | [`0x0929…a450`](https://explorer.test.mezo.org/tx/0x092903187a0c792c4fe03a46482867826468a33321f5a1f82d13239274ea4450) |
| **Peg pressure:** that single buyback moved the pool's MUSD price | **$0.9505 → $0.9572** (+0.7%) | same tx |
| **Stability Pool:** the vault moved its spare MUSD into Mezo's Stability Pool | **240 MUSD deployed**, exactly the 80% cap, 60 MUSD kept liquid | [`0xfd1d…2ca6`](https://explorer.test.mezo.org/tx/0xfd1d2fe94343dc0b6ffccc17db0c7b2682b6ce3e188b8663e36e071c9d192ca6) |
| **AI veto:** Claude was given a plan whose expected profit was wrong | **Vetoed.** "Redeeming 500 MUSD after the 0.75% fee gives about $496.25 of BTC… returns only about 506.4 MUSD, not the proposed 508.40." | keeper smoke test |
| **Guardrail:** keeper simulated a peg trade when Mezo would cancel the redemption | **Nothing sent**: the trade reverted in simulation, and the vault stayed whole | keeper log |
| **Automated tests** | **15 passing** (10 contract, 5 keeper) | `npx hardhat test`, `npm test` |

The vault's share price went up by exactly the trade profit: **300.000 → 300.118 MUSD** of assets for 300 shares.

**About the 5% drill.** Testnet MUSD trades *above* $1 (about $1.02), so there's no below-peg trade to make on Mezo's testnet pool. To show the full loop, we seeded a small, clearly labelled "depeg drill" pool at $0.95 and whitelisted it. The redemption itself is real: it ran against Mezo's TroveManager and burned real testnet MUSD. On mainnet the vault would only whitelist Mezo's own pools. Profit scales with pool depth and the size of the depeg; on Oct 25, mainnet MUSD sat at **$0.9926**, right at the redemption floor.

---

## Why this matters

A stablecoin's floor is only as strong as the people willing to buy it back. MUSD can always be redeemed for $1 of BTC minus a 0.75% fee, and that is what holds the floor, but only if someone runs the trade. Running it means redemption hints that go stale every block, knowing the trove queue, and a route to sell the BTC. Today that's people with their own bots.

Tiller packages that trade into a deposit. Every MUSD in Tiller is MUSD standing ready to defend the peg. Of the 44 Wave 1 Buildathon entries, **none other defends the peg**.

---

## How it works

```
 depositors ──MUSD──▶ TillerVault  (ERC-4626, tMUSD shares)
                         │
        ┌────────────────┼──────────────────────────────────┐
        ▼                ▼                                  ▼
   idle buffer     Mezo Stability Pool                 peg trade
   (≥10%, for      provideToSP / withdrawFromSP         HintHelpers + SortedTroves  (same tx)
   withdrawals)    BTC from liquidations                TroveManager.redeemCollateral
                     └─ harvest ─▶ Mezo pool ─▶ MUSD    BTC ─▶ Mezo pool ─▶ more MUSD
                                                        reverts unless MUSD ends higher

 keeper: read Mezo ─▶ plan with fixed rules ─▶ Claude review (approve / veto)
                    ─▶ simulate ─▶ send ─▶ check receipt ─▶ Decision event with the reason
```

### Hard limits enforced by the contract

Neither the keeper nor the AI can get around these.

| Guardrail | How |
|---|---|
| Only the keeper can move funds; a guardian can pause | `KEEPER_ROLE`, `GUARDIAN_ROLE` |
| At most 80% in the Stability Pool, at least 10% ready for withdrawals | `spCapBps`, `minIdleBps`, checked after every deposit |
| Swaps only through whitelisted MUSD/BTC pools | `setPool` checks the pair; `isPool` |
| BTC never sold for less than Mezo's oracle price minus 1.5% | `_swapBtcForMusd` |
| A peg trade must end with more MUSD than it started | `pegArb` → `NoProfit` revert |
| Pausing stops deposits and trades, never withdrawals | `_deposit`, `_withdraw` |
| Share price never counts unsold BTC | `totalAssets` = idle MUSD + Stability Pool deposit |

### What Claude does, and what it can't do

Each run, the keeper sends Claude (Opus 5.5) a structured snapshot: BTC price, Mezo's system collateral ratio, vault balances, MUSD price per pool, and the planned actions with expected outputs. Claude returns `approve`, `risk_level`, `summary` and `concerns` as structured output.

- **Its one power is a veto**, and a veto can only make the vault do less.
- **It fails closed:** an API error or a refusal counts as a veto, so the AI being down never moves money.
- **Its summary is the on-chain reason**, written for depositors in plain English.
- **It checks what the contract can't:** whether the numbers add up, whether a pool's price is out of line with the others, and whether Mezo is close to Recovery Mode.

---

## Mezo integration

| Mezo piece | How Tiller uses it |
|---|---|
| **MUSD** `0x1189…c503` | vault asset |
| **TroveManager** `redeemCollateral`, `getTCR`, `getEntireDebtAndColl` | peg trades, system-stress signal, redemption sizing |
| **HintHelpers** `getRedemptionHints` + **SortedTroves** `findInsertPosition` | redemption hints, computed inside the vault's own transaction |
| **StabilityPool** `provideToSP`, `withdrawFromSP`, `getCompoundedMUSDDeposit`, `getDepositorCollateralGain` | yield and share accounting |
| **PriceFeed** `fetchPrice` | swap floor in the contract; prices in the keeper |
| **BorrowerOperations** `redemptionRate`, `minNetDebt` | exact trade math |
| **Mezo Pools** basic pool `getAmountOut` / `swap` | selling BTC back to MUSD |
| **BTC ERC-20 precompile** `0x7b7c…0000` | native BTC moved as a token (same balance) |

### What we learned about Mezo redemptions (feedback for the Mezo team)

1. **Hints must be computed in the same transaction.** Mezo's oracle updates every block, and a partial redemption is cancelled unless `_partialRedemptionHintNICR` falls in a window that covers about 10 minutes of interest drift, but not price drift. Hints computed even 12 seconds earlier failed. `TillerVault` calls `HintHelpers` and `SortedTroves` itself, right before `redeemCollateral`.
2. **`getRedemptionHints` doesn't truncate for the minimum net debt.** It reported 18.75 MUSD as redeemable from a trove only 3.18 MUSD above the 1,800 MUSD minimum, and the redemption then cancelled. The keeper now caps the size itself.
3. **One trove at exactly the minimum debt blocks small redemptions.** Redemptions start at the lowest-ratio trove and stop at the first cancelled partial. After our trades used up the head trove's spare 3 MUSD, no partial redemption was possible on testnet. Below $1, that queue can't be defended by small arbitrageurs. A protocol-level fix could skip or fully redeem such troves.

---

## Live deployment (Mezo testnet)

| Contract | Address |
|---|---|
| TillerVault (v3, current) | [`0xC3113D5302339F18A8C554095ECEf7D9DE3eb491`](https://explorer.test.mezo.org/address/0xC3113D5302339F18A8C554095ECEf7D9DE3eb491) |
| TillerVault (v2, first peg trade) | [`0x6812ECBE0D4e40891a1561b31380745b19fd185A`](https://explorer.test.mezo.org/address/0x6812ECBE0D4e40891a1561b31380745b19fd185A) |
| Depeg drill pool | [`0x4f22B47d495F7AADA4f6CD8B8715648C62782440`](https://explorer.test.mezo.org/address/0x4f22B47d495F7AADA4f6CD8B8715648C62782440) |
| Keeper | `0x99B16E4C0516C6FfC9B26036Ac360d3A14a8aC31` |

**Why three versions:** testing on the live chain found two things the mocks didn't. v1 → v2 moved the redemption hints on-chain (the oracle-drift finding above). v2 → v3 added the `transferFrom` approval Mezo's Stability Pool needs; the mock now enforces it too, so the tests catch it.

---

## Tests

**Contracts, 10 passing** (`cd contracts && npx hardhat test`)

- counts Stability Pool deposits in `totalAssets`
- enforces the Stability Pool cap and idle buffer
- only lets the keeper act
- pulls from the Stability Pool when a withdrawal exceeds the idle buffer
- makes a profit on peg arbitrage when MUSD trades under $1
- refuses peg arbitrage that would lose money
- refuses pools that are not whitelisted
- harvests liquidation BTC back into MUSD at near oracle value
- blocks a harvest into a bad price
- pause stops new risk but never blocks withdrawals

**Keeper, 5 passing** (`cd keeper && npm test`)

- deposits spare idle MUSD into the Stability Pool up to the cap
- keeps the idle buffer plus margin
- does nothing while paused
- harvests through the pool paying the most MUSD
- picks the most profitable arb and skips unprofitable ones

**End-to-end with real MetaMask, 1 passing** (`cd e2e && npm test`). Synpress 4 and Playwright drive MetaMask 13 against the live Mezo testnet vault:
- connect the wallet, and the app adds Mezo Testnet to MetaMask
- check input validation, approve MUSD, deposit 1 MUSD, withdraw it
- check the Overview, Activity, Peg monitor and Risk pages

Passed twice in a row on Oct 25, 2026. The deposit and withdrawal are on chain: [deposit](https://explorer.test.mezo.org/tx/0x3bee4d516f2e08d28b71724ded9a05ac360dfd60be88cd6fc053010a9acd4b46), [withdraw](https://explorer.test.mezo.org/tx/0xc5fc1d7c9f6df1dd1cf0ec7254eed4d8807d8287b6aba59cca57bae5af0db57e). On Windows, build the MetaMask cache with `node build-cache.mjs`, because the Synpress CLI only runs on Linux, macOS or WSL; elsewhere use `npx synpress wallet-setup`. The test wallet comes from `E2E_MNEMONIC` in `.env` (testnet only) and is funded by `contracts/scripts/fund.js`.

**Live checks on Mezo testnet:** the peg trade, the Stability Pool deposit, Claude approvals and a Claude veto, the simulate-before-send guard, and receipt checks.

---

## Repo

| Folder | What's inside |
|---|---|
| [`contracts/`](contracts) | `TillerVault.sol`, `DrillPool.sol`, Mezo interfaces, mocks, tests, deploy/drill/deposit scripts |
| [`keeper/`](keeper) | TypeScript keeper: snapshot, rule planner, Claude review, executor |
| [`app/`](app) | Vite + React + viem site on Cloudflare: landing page, plus a multi-page vault app (Overview, Earn, Peg monitor, Activity, Risk & contracts) with wallet connect, network switching and transaction toasts |
| [`e2e/`](e2e) | Synpress + Playwright end-to-end test with real MetaMask on Mezo testnet |
| [`docs/`](docs) | [PRD](docs/PRD.md), [design](docs/superpowers/specs/2026-10-25-tiller-finance-design.md), [Mezo reference](docs/mezo-reference.md), [composability map](docs/composability.md), [competition notes](docs/competition-wave1.md) |

## Run it yourself

```bash
cp .env.example .env     # DEPLOYER_KEY / KEEPER_KEY (testnet only), ANTHROPIC_API_KEY

cd contracts && npm i && npx hardhat test
BTC_COLL=0.042 MUSD_DEBT=1800 npx hardhat run scripts/open-trove.js --network mezotestnet   # borrow test MUSD
npx hardhat run scripts/deploy.js --network mezotestnet
SWAP_MUSD=500 DRILL_BTC=0.006 DRILL_DISCOUNT_BPS=500 npx hardhat run scripts/drill.js --network mezotestnet
AMOUNT=300 npx hardhat run scripts/deposit.js --network mezotestnet

cd ../keeper && npm i && npm test
DRILL_MODE=1 MIN_ARB_PROFIT=0.05 npm run once      # one keeper run; drop "once" to loop

cd ../app && npm i && npm run dev                  # http://localhost:5173 and /app
npx wrangler deploy                                # Cloudflare (tillerfinance.xyz)
```

## Stack

Solidity 0.8.28 · OpenZeppelin 5.1 (ERC-4626, AccessControl, Pausable) · Hardhat · TypeScript · viem · Anthropic SDK (Claude Opus 5.5, structured outputs) · React 19 · Vite · Cloudflare Workers static assets

## Known limits

- Unaudited hackathon code on testnet.
- Unsold BTC is left out of the share price. That's safe (it understates value), but a deposit made just before a harvest shares gains it didn't earn.
- Peg defence works below $1 only; defending above $1 needs a vault-owned trove (Wave 2).
- The keeper only redeems inside the first trove in the queue; multi-trove sizing comes in Wave 2.
- The decision log reads the last 10,000 blocks, an RPC limit; an indexer comes later.

## Roadmap

| When | What |
|---|---|
| Wave 2 (Nov 2–15) | Mainnet with a deposit cap against Mezo's real pools |
| Wave 2 | sMUSD and MUSD/mUSDC liquidity strategies with gauge rewards; defending the peg above $1 |
| Wave 2 | Telegram: "why did my vault do that?" answered from the on-chain log (Track 2) |
| Dec 2026 | Ethereum and Base: Curve and Aerodrome MUSD strategies via Wormhole NTT |
| Q1 2027 | External audit; Claude adjusts limits within admin-set bounds |

Full product spec: [docs/PRD.md](docs/PRD.md).
