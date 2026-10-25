# Wave 1 competition (snapshot 2026-10-25)

Pulled all 44 public entries from AKINDO (`api.akindo.io/public/wave-hacks/OVOO0gdrVU8379D10/products`). Raw dump lives in the session scratchpad; re-run to refresh.

## Where the 44 entries sit

| Cluster | Count | Entries |
|---|---|---|
| Loan (trove) protection / alerts | 9 | Vigil, Lifeline, AgentVault, Bulwark, Trove Guardian, Liqvera, Lockwatch, MUSD Pulse, Pylon (shield part) |
| Looping / leverage | 4 | Coil (Wilivms), Coil (PrabalParihar), Pylon, Mezodot |
| Payments, invoices, links, payroll | 11 | MUSD Pay Links, PayLink, PayLink Digital Products, SettleTag, Mezher, Remitsheet, MUSD Subs, MUSD Books, Kudi, Pocket, Runway |
| Escrow / freelance | 4 | MezoGig, Mezo TradeOS, TrustieWork, Wasit |
| Yield vaults / LP | 4 | MUSD Yield Vault, mbLP, MezoRoute, Mezo Flow |
| Consumer savings / social | 3 | MUSD Pocket, Round, Morbit |
| Agents / x402 | 1 | Mezo Agent Toolkit (x402 also used by Liqvera, Mezher, Coil, Pylon) |
| Lending | 1 | Cosign (Morpho Blue, MEZO collateral, first-loss cover) |
| Other | 2 | LeekWallet/Leek Stonks (synthetic index + DIY hardware wallet), MezoLens |
| Empty or placeholder | 7 | 3× "TAWFIK…", kept, Origame, MEZO-LOCK, (and near-empty Mezodot/Wasit/Runway/Pocket have no repo) |

## The bar to beat

The strong entries all have: deployed contracts on Mezo testnet (a few on mainnet: MezoRoute, Coil, Pylon), a public repo with tests, a video, a deck, exact contract addresses, and a "judge check in 60 seconds" section. Several go deep into Mezo internals (SortedTroves hints, `*WithSignature` functions, the 20-precompile-calls-per-transaction limit, flash swaps from the MUSD/BTC pool).

Strongest by depth: **Pylon**, **Coil (Wilivms)**, **Lifeline**, **Vigil**, **MezoRoute**, **mbLP**, **Mezo Agent Toolkit**, **Liqvera**, **Cosign**.

## Gaps nobody has touched

- **MUSD peg defence**: 0 entries mention redemption arbitrage, `redeemCollateral`, or the peg. Liquity-style stablecoins depend on arbitrageurs, and Mezo's Stability Pool earns only from liquidations.
- **Real deployments on other chains**: only Mezo Flow and Mezodot claim cross-chain, and neither has a public repo. Ethereum, Base and BNB are all open.
- **MEZO token utility beyond ve-voting**: only Cosign (MEZO as Morpho collateral) and Leek Stonks (MEZO staking for fee discounts).
- **Liquidation infrastructure**: no public liquidation keeper / Stability Pool tooling.

## Ideas to avoid

Trove alerts or protection, one-click looping, payment links/invoices and escrow are each crowded with 4–11 polished entries.
