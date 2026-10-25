# Tiller Finance: Product Requirements Document

| | |
|---|---|
| Product | Tiller Finance, a MUSD peg-defence vault on Mezo |
| Stage | Wave 1 shipped on Mezo testnet (Oct 25, 2026); Wave 2 in planning |
| Program | Mezo Buildathon on AKINDO, Track 1 (DeFi) |
| Live | https://tillerfinance.xyz (landing) · https://tillerfinance.xyz/app (vault) |
| Last updated | Oct 25, 2026 |

## 1. Summary

Tiller is an ERC-4626 vault for MUSD, Mezo's Bitcoin-backed stablecoin. Deposits earn in two ways that both strengthen MUSD:

1. **Peg trades.** When MUSD trades below $1, the vault redeems MUSD through Mezo for $1 of BTC, sells that BTC back where MUSD is cheap, and keeps the difference. Each trade buys MUSD back toward $1.
2. **Stability Pool.** Between depegs, deposits back Mezo's Stability Pool and earn discounted BTC from liquidations. That BTC is sold back to MUSD.

A rule-based keeper proposes every move. Claude reviews each plan and can veto it, and the reason is written on-chain. The contract enforces hard limits that neither the keeper nor the AI can bypass.

## 2. Problem

- **The peg floor depends on arbitrage that ordinary holders can't run.** MUSD is a Liquity-style stablecoin: 1 MUSD can always be redeemed for $1 of BTC minus a 0.75% fee. That is what sets the floor, but only if someone actually runs the trade. On Oct 25, 2026, mainnet MUSD sat at $0.9926 in the MUSD/BTC pool, right at that floor.
- **Running the trade is hard.** It needs redemption hints that go stale every block, knowledge of the trove queue and minimum-debt rules, and a sell route for the BTC. Today only people with their own bots do it.
- **Idle MUSD earns little.** Mezo's own sMUSD vault paid around 4.2% at the time, and the Stability Pool earns only when liquidations happen.
- **AI agents that move money are hard to trust.** Users and judges reasonably ask what stops an AI from making a bad trade.

## 3. Goals and non-goals

### Goals (Wave 1, done)
- G1. A depositor can put MUSD in and take it out at any time, even while trading is paused.
- G2. The vault makes peg trades that are profitable by construction: a trade reverts unless the vault ends with more MUSD.
- G3. Idle MUSD is put to work in the Stability Pool within contract limits.
- G4. Every move is reviewed by an AI, explained in plain English, and recorded on-chain.
- G5. Everything is verifiable: deployed contracts, real transactions, public tests.

### Non-goals (Wave 1)
- Cross-chain strategies (Ethereum, Base, BNB).
- Defending the peg above $1, which needs minting MUSD from a vault-owned trove.
- Letting the AI pick allocations freely.
- Mainnet deployment with real funds.

### Anti-goals
- The AI must never be able to lose user funds.
- The vault must never report more value than it can pay out.

## 4. Users

| User | Need | What Tiller gives them |
|---|---|---|
| MUSD holder (primary) | Yield on MUSD without running infrastructure | One deposit, automatic peg trades and Stability Pool yield |
| BTC borrower on Mezo | A healthier MUSD peg and more MUSD demand | A standing buyer under $1 |
| Mezo protocol team | Peg stability without subsidies | Arbitrage capacity packaged as a product, plus integration feedback |
| Integrators | A composable yield-bearing MUSD | The tMUSD ERC-4626 share token |

## 5. How it works

### 5.1 Contract: `TillerVault` (Solidity 0.8.28, OpenZeppelin 5.1, evm london)

| Function | Who | What |
|---|---|---|
| `deposit` / `withdraw` / `redeem` | anyone | ERC-4626. A withdrawal pulls from the Stability Pool if the idle buffer is short. Never blocked by pause. |
| `depositToStabilityPool(amount, why)` | keeper | Approves and calls `provideToSP`, then checks the SP cap and idle floor. |
| `withdrawFromStabilityPool(amount, why)` | keeper or guardian | Reduces risk, so it works while paused. |
| `harvest(pool, why)` | keeper | Claims Stability Pool BTC and sells all BTC for MUSD at no worse than oracle minus slippage. |
| `pegArb(musdIn, pool, minProfit, why)` | keeper | Computes redemption hints in the same transaction, calls `redeemCollateral`, sells the BTC, and reverts unless MUSD rose by `minProfit`. |
| `note(why)` | keeper | Records a decision that moves nothing, such as an AI veto. |
| `setLimits`, `setPool`, `pause`, `unpause` | admin / guardian | Bounded configuration. |

`totalAssets` = idle MUSD + compounded Stability Pool deposit. Unharvested BTC is deliberately left out, so the vault undervalues rather than overvalues.

### 5.2 Guardrails

| Guardrail | Default |
|---|---|
| Max share in Stability Pool | 80% |
| Min idle buffer | 10% |
| Max BTC→MUSD slippage vs Mezo oracle | 1.5% |
| Swap venues | whitelisted MUSD/BTC pools only |
| Peg trade outcome | must end with ≥ `minProfit` more MUSD |
| Pause | stops deposits and trades, never withdrawals |

### 5.3 Keeper (TypeScript, viem)
1. **Read:** BTC price, system collateral ratio (TCR), vault balances, each pool's MUSD price from a tiny quote, and redeemable trade sizes. Sizes are capped at what the first trove in the queue can give up above Mezo's 1,800 MUSD minimum.
2. **Plan with fixed rules:** harvest when BTC is pending; make the most profitable peg trade above a minimum profit; otherwise move spare MUSD into the Stability Pool up to the cap.
3. **Review:** Claude (Opus 5.5, structured output) returns `approve`, `risk_level`, `summary` and `concerns`. API errors or refusals count as a veto (fail closed).
4. **Execute:** simulate, estimate gas, send, and check the receipt. The summary becomes the on-chain reason.

### 5.4 App
- Landing page explaining the product with live chain data and testnet proof.
- `/app`: live peg gauge per pool, vault stats, deposit and withdraw, and the decision log read from `Decision` events.

## 6. Mezo integration

MUSD (vault asset) · `TroveManager.redeemCollateral`, `getTCR`, `getEntireDebtAndColl` · `HintHelpers.getRedemptionHints` · `SortedTroves.findInsertPosition` · `StabilityPool.provideToSP`, `withdrawFromSP`, `getCompoundedMUSDDeposit`, `getDepositorCollateralGain` · `PriceFeed.fetchPrice` · `BorrowerOperations.redemptionRate`, `minNetDebt` · Mezo Pools basic pool `getAmountOut` / `swap` · BTC ERC-20 precompile `0x7b7c…0000`.

## 7. Results so far (Mezo testnet, Oct 25, 2026)

| Result | Evidence |
|---|---|
| Peg trade: redeemed 3.167 MUSD, **+0.118 MUSD profit (3.7%)**, Claude approved | tx `0x0929…a450` |
| Drill pool MUSD price moved $0.9505 → $0.9572 after one trade | same tx |
| 240 MUSD deployed to the Stability Pool (80% cap), Claude approved | tx `0xfd1d…2ca6` |
| Claude vetoed a test plan whose expected profit didn't match the redemption math | keeper smoke test |
| 15 automated tests passing (10 contract, 5 keeper) | `npx hardhat test`, `npm test` |

The drill pool is a labelled testnet pool seeded under $1, because testnet MUSD trades above $1 (about $1.02).

## 8. Success metrics

| Metric | Wave 1 | Wave 2 target |
|---|---|---|
| Deployed and verifiable | testnet | mainnet with a deposit cap |
| Profitable peg trades | 1 live | every depeg window over the fee floor captured |
| Net APY vs sMUSD | n/a on testnet | ≥ sMUSD after costs, or hold sMUSD |
| Decisions with an on-chain reason | 100% | 100% |
| Incidents where a guardrail was bypassed | 0 | 0 |

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Bad trade from the keeper or AI | Contract reverts unprofitable peg trades; oracle-bounded swaps; whitelist |
| Prompt injection or AI outage | AI can only veto; fails closed; inputs are numeric chain data |
| Stale redemption hints | Hints computed on-chain in the same transaction |
| Redemption queue blocked by a trove at minimum debt | Keeper caps size; full-trove redemptions in Wave 2 |
| Stability Pool losses during liquidations | Gains are BTC at a discount; harvest promptly; cap at 80% |
| Withdrawal blocked when Mezo has undercollateralized troves | Idle buffer of at least 10% |
| Deposit just before a harvest captures gains | Known shortcut; oracle-valued gains with a haircut in Wave 2 |
| Unaudited code | Testnet only; cap and external review before mainnet |

## 10. Roadmap

| When | Milestone |
|---|---|
| Nov 2–15 (Wave 2) | Mainnet with a deposit cap against real Mezo pools; sMUSD and MUSD/mUSDC liquidity strategies; above-peg defence via a vault-owned trove |
| Nov 2–15 (Wave 2) | Telegram bot: "why did my vault do that?" answered from the on-chain log |
| Dec 2026 | Ethereum and Base strategies (Curve, Aerodrome) with MUSD over Wormhole NTT |
| Q1 2027 | External audit; Claude adjusts limits within admin-set bounds |

## 11. Open questions for the Mezo team

1. Can `HintHelpers.getRedemptionHints` truncate for the minimum net debt, as the redemption itself does?
2. Should redemptions skip, or fully redeem, a trove that would fall under the minimum debt, instead of stopping?
3. Would Mezo whitelist a peg-defence vault for a gauge, so MEZO emissions reward peg support?
