# Tiller Finance: design (Wave 1)

## Intent

A MUSD vault on Mezo that earns yield by defending MUSD's $1 peg and by backstopping liquidations. Plain on-chain math does the work. Claude acts as a risk manager: it reviews each planned action, can veto it, and explains every decision in public.

The pitch: *"MUSD savings that make MUSD stronger."* Every profitable trade the vault makes pushes MUSD back toward $1.

## Why this, why now

- No Wave 1 entry (out of 44) defends the peg. Loan protection, looping and payments are crowded.
- Evidence: on mainnet (2026-10-25) MUSD trades at $0.9926 in the MUSD/BTC pool, right at the 0.75% redemption-fee floor. Redemption arbitrage is what sets that floor; today nobody packages it as a product people can deposit into.
- It extends existing Mezo products (redemptions, Stability Pool, Mezo Pools) instead of building beside them.

## Goals (Wave 1)

1. `TillerVault`: an ERC-4626 vault over MUSD on Mezo testnet (share token `tMUSD`).
2. Three uses of deposits:
   - **Idle buffer**: MUSD kept in the vault for instant withdrawals.
   - **Stability Pool**: MUSD earns discounted BTC from liquidations. A harvest swaps that BTC back to MUSD.
   - **Peg arbitrage**: when MUSD trades below $1, redeem MUSD for $1 of BTC through `TroveManager.redeemCollateral`, then sell the BTC for more MUSD in a whitelisted Mezo pool. This must happen in one transaction, and it reverts unless the vault ends with more MUSD than it started.
3. On-chain guardrails that bind both the keeper and the AI:
   - keeper-only actions
   - whitelisted pools
   - a cap on the Stability Pool share and a minimum idle buffer, in basis points
   - an oracle-checked minimum output on every BTC→MUSD swap
   - a required profit on arbitrage
   - a guardian who can pause
4. A keeper bot (TypeScript) that reads state, plans actions with fixed rules, and asks Claude to approve and explain them. Each decision is emitted on-chain as a short note.
5. A dashboard: deposit and withdraw, vault stats, the peg gauge, and a decision feed read from on-chain events.

## Non-goals (Wave 1)

- Cross-chain strategies (Ethereum Curve, Base Aerodrome). These come in Wave 2.
- Defending the peg *above* $1 (minting MUSD from a trove and selling it). Wave 2.
- sMUSD, LP and gauge strategies. Wave 2.
- A Telegram bot. Wave 2.
- Claude choosing allocations freely. In Wave 1 it can only approve or veto, and explain.

## Anti-goals

- The AI must never be able to lose user funds. Every path it can trigger is bounded on-chain.
- The vault must never report more value than it can actually pay out.

## Key decisions

- **No tokens besides MUSD stay at rest.** BTC from redemptions and the Stability Pool is swapped back to MUSD in the same call (arbitrage) or at harvest.
- **`totalAssets` = idle MUSD + compounded Stability Pool deposit.** Unharvested BTC gains are left out, which undervalues the vault rather than overvaluing it. *Shortcut: a depositor who enters just before a harvest gets a small share of those gains; Wave 2 can value BTC gains with the oracle and a haircut.*
- **Swaps go straight to the pool** (Aerodrome-style `getAmountOut` + `swap`), not through the router, which avoids extra approvals.
- **On Mezo, native BTC and the BTC ERC-20 at `0x7b7c…0000` are the same balance.** The vault receives native BTC and transfers it as an ERC-20 to the pool.
- **Claude only has one power: veto.** A veto can only make the vault do less, so a prompt injection or a bad answer can't cost money.
- **Testnet demo:** the testnet MUSD/BTC pool trades above peg ($1.024), so the demo seeds a small whitelisted pool below peg to show the arbitrage. The demo says so plainly.

## Mezo integration points

`TroveManager.redeemCollateral`, `HintHelpers.getRedemptionHints`, `SortedTroves.findInsertPosition`, `StabilityPool.provideToSP` / `withdrawFromSP` / `getCompoundedMUSDDeposit` / `getDepositorCollateralGain`, `PriceFeed.fetchPrice`, Mezo Pools (`getAmountOut`, `swap`, `PoolFactory.createPool`), and the BTC ERC-20 precompile.

## Left to the builder

The exact basis-point defaults, the keeper's cadence, and dashboard styling.
