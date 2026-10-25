# Where MUSD and MEZO can go (snapshot 2026-10-25)

Source: DefiLlama protocols + yields APIs, filtered by Mezo's MUSD address `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` (same address on Mezo mainnet and Ethereum). Symbol-only matches are wrong: "MUSD" also names MetaMask USD (`0xacA92E…35DA`) and the old mStable mUSD. Always match by address.

## Live venues for Mezo MUSD

| Chain | Venue | What | TVL | APY |
|---|---|---|---|---|
| Mezo | Mezo Vaults (sMUSD) | Mezo's savings vault, fee-backed | $2.1M | 4.23% |
| Mezo | sMUSD staked in gauge | MEZO emissions instead of fees | $5.3M | 1.25% |
| Mezo | Stability Pool | BTC from liquidations | n/a | variable |
| Mezo | Tigris (Mezo Pools) | MUSD/BTC, MUSD/mUSDC, MUSD/mUSDT + gauges | $5.3M (V3) | varies |
| Ethereum | Curve MUSD/crvUSD-style pool | LP + CRV | $650k | 12.6% |
| Ethereum | Stake DAO on that Curve pool | boosted CRV | $549k | 15.0% |
| Ethereum | Convex on that Curve pool | boosted CRV | $96k | 12.8% |
| Ethereum | Uniswap v4 USDC-MUSD | LP | $68k | ~0% |
| Base | Aerodrome Slipstream USDC-MUSD | CL LP | $1.16M | 0.97% |

## Other protocols live on Mezo chain

Mezo Earn ($64M, BTC 2.9% / MEZO 36%), Mezo Borrow, Mellow Core ($192k, curated vaults), Boar Finance ($180k, BTC 13.7%), Upshift, Ditto Earn, Velar Perps, BitFire (lending, ~$0).

## Moving MUSD between chains

Wormhole NTT (`mezo-org/ntt-bridge-mezo-mainnet`). MUSD artifacts exist for Ethereum and Sepolia; Base has a `TokenDeployer` + no-op contracts.

## What this means for a yield product

- Baseline to beat: sMUSD at ~4.2% with no effort. A strategy that can't beat it net of gas, bridge and swap costs should just hold sMUSD.
- The best rates for Mezo MUSD today are on Ethereum (Curve + Stake DAO/Convex, ~12–15%, mostly CRV rewards that can disappear).
- Ethereum and Base venues exist on mainnet only. A testnet demo can run Mezo-native strategies for real and only read mainnet data for the cross-chain ones.
- Professional curators (Mellow, Upshift) already run vaults on Mezo, so they're competition. They're also venues a vault could deposit into.
