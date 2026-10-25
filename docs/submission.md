# Wave 1 submission kit (draft: rewrite in your own words)

## AKINDO form

- **Project name:** Tiller Finance
- **Category:** peg stability yield vault
- **TL;DR:** A MUSD vault on Mezo that earns by buying MUSD back below $1 and backing the Stability Pool, with an AI risk check on every move.
- **How it works:** see the README sections "Why", "How it works" and "What Claude does". Lead with the mainnet evidence: MUSD at $0.9926, right at the redemption floor.
- **Target group:** MUSD holders who want yield without running bots (desktop, intermediate DeFi users), and Mezo itself, which gets a standing buyer under the peg.
- **Tech stack:** Solidity 0.8.28 + OpenZeppelin 4626, Hardhat; TypeScript keeper with viem and the Anthropic SDK (Claude Opus 5.5, structured outputs); React + Vite + viem dashboard.
- **Track:** Track 1 (DeFi)
- **Chain:** Mezo testnet
- **Status:** entirely new
- **Readiness:** testnet deployment
- **Future milestones:** the three Wave 2 items in the README, then mainnet with a capped deposit limit after an external review (target Dec 2026).
- **Team:** fill in names, roles, X/LinkedIn.

## 2-minute video script

| Time | Show | Say |
|---|---|---|
| 0:00–0:15 | Mezo mainnet pool price $0.9926 | "MUSD is Bitcoin-backed and redeemable for $1 of BTC. When it slips under $1, someone has to buy it back. Today that's only people running their own bots." |
| 0:15–0:35 | Dashboard peg gauge | "Tiller is a MUSD vault that does that job. Deposit MUSD; the vault redeems cheap MUSD for $1 of BTC, sells the BTC back for more MUSD, and keeps the difference." |
| 0:35–0:55 | Deposit tx | Deposit MUSD, show tMUSD and the vault total update. |
| 0:55–1:20 | Keeper terminal + drill pool | Run the keeper: plan, Claude approves, PEG_ARB tx, "+X MUSD" in the log. Say clearly that it's a testnet drill pool. |
| 1:20–1:40 | Contract guardrails table | "The AI can only veto. The contract refuses any trade that doesn't end with more MUSD, sells BTC at most 1.5% under the oracle, and never blocks withdrawals." |
| 1:40–2:00 | Claude veto entry | "Here Claude stopped a trade whose math didn't add up. Next: mainnet, sMUSD and LP strategies, and defending the peg above $1." |

## Deck (6 slides)

1. Tiller Finance: MUSD savings that make MUSD stronger.
2. The problem: the peg floor depends on arbitrage that ordinary holders can't run. Mainnet evidence.
3. How it works: the diagram from the README.
4. Safety: the guardrails table, plus the fail-closed AI.
5. Mezo integration: the contract list, plus why it extends Mezo instead of sitting beside it.
6. Roadmap and asks: Wave 2 milestones; mainnet pool whitelisting; feedback from the Mezo team on the redemption flow.
