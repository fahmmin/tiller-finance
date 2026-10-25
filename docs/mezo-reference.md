# Mezo builder reference

Collected 2026-10-25 from the official docs repo (`mezo-org/documentation`) and `mezo-org/musd` deployment artifacts. Re-check on the explorer before relying on an address.

## Key dates (Mezo Buildathon on AKINDO)

| What | When |
|---|---|
| Wave 1 build ends | **Oct 26, 2026** |
| Wave 1 judging | Oct 27 – Nov 1 |
| Wave 2 build ($5k pool) | Nov 2 – Nov 15 |
| Wave 2 judging | Nov 16 – Nov 22 |
| Demo day | Nov 23 (online) |

Scoring: Mezo integration 30% · product/business viability 30% · technical 20% · UX 10% · materials 10%.
Submit: live link, public GitHub, deck, 2-min video, AKINDO form.

## Networks

| | Testnet | Mainnet |
|---|---|---|
| Chain ID | `31611` | `31612` |
| RPC | `https://rpc.test.mezo.org` / `wss://rpc-ws.test.mezo.org` | `https://mezo.drpc.org`, `https://mezo-mainnet.boar.network` |
| Explorer | https://explorer.test.mezo.org | https://explorer.mezo.org |
| Gas | BTC (18 decimals) | BTC (18 decimals) |

Solidity `0.8.28`, `evmVersion: london`. Faucet: https://faucet.test.mezo.org (BTC + MEZO). Get MUSD by borrowing at https://testnet.mezo.org.
Wallet connect: `@mezo-org/passport` (RainbowKit + wagmi + viem 2, supports BTC wallets like Xverse/Unisat).

## MUSD (Liquity fork)

MCR 110% · CCR 150% (Recovery Mode below) · min net debt 1,800 MUSD · 200 MUSD gas compensation · fixed simple interest per trove, `refinance()` to the current global rate · redemptions hit the lowest-ICR troves first · Stability Pool earns only from liquidations.

| Contract | Testnet (matsnet) | Mainnet |
|---|---|---|
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |
| BorrowerOperations | `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` | `0x44b1bac67dDA612a41a58AAf779143B181dEe031` |
| BorrowerOperationsSignatures | `0xD757e3646AF370b15f32EB557F0F8380Df7D639e` | `0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a` |
| TroveManager | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` | `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193` |
| StabilityPool | `0x1CCA7E410eE41739792eA0A24e00349Dd247680e` | `0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32` |
| PriceFeed | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` | `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88` |
| HintHelpers | `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6` | `0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3` |
| SortedTroves | `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA` | `0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f` |
| PCV | `0x4dDD70f4C603b6089c07875Be02fEdFD626b80Af` | `0x391EcC7ffEFc48cff41D0F2Bb36e38b82180B993` |
| sMUSD Savings Vault | ? | `0xb4D498029af77680cD1eF828b967f010d06C51CC` |

MUSD is EIP-2612 (EIP-712 domain name `Mezo USD`, version `1`). Also deployed on Ethereum; bridged via Wormhole NTT.

## Mezo Pools (Aerodrome / Velodrome Slipstream style)

| Contract | Testnet | Mainnet |
|---|---|---|
| Router (basic) | `0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9` | `0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706` |
| PoolFactory | `0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A` | `0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248` |
| MUSD/BTC pool | `0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9` | `0x52e604c44417233b6CcEDDDc0d640A405Caacefb` |
| MUSD/mUSDC pool | `0x525F049A4494dA0a6c87E3C4df55f9929765Dc3e` | `0xEd812AEc0Fecc8fD882Ac3eccC43f3aA80A6c356` |
| MUSD/mUSDT pool | `0x27414B76CF00E24ed087adb56E26bAeEEe93494e` | `0x10906a9E9215939561597b4C8e4b98F93c02031A` |
| CLFactory | `0x7B61BC8Aa460476d142F1CD107A47297002f69ff` | `0xBB24AF5c6fB88F1d191FA76055e30BF881BeEb79` |
| CLSwapRouter | `0x3112908bB72ce9c26a321Eeb22EC8e051F3b6E6a` | `0x37cDd11919ec3860eaD9efB8673d7476E5326225` |
| NonfungiblePositionManager | `0x9B753e11bFEd0D88F6e1D2777E3c7dac42F96062` | `0x509Bc221df2B83927c695FA0bb0f5B21053C874c` |
| CLGaugeFactory | `0x5b0dbAfdcE363d6662F36163D91862B0a3808373` | `0xfc41E1AAe0e58E8bDC32e85d8C995A902FEdEb13` |
| VeBTC | `0xB63fcCd03521Cf21907627bd7fA465C129479231` | `0x7D807e9CE1ef73048FEe9A4214e75e894ea25914` |
| VeBTCVoter | `0x72F8dd7F44fFa19E45955aa20A5486E8EB255738` | `0x3A4a6919F70e5b0aA32401747C471eCfe2322C1b` |
| PoolsVoter (create gauges) | ? | `0x48233cCC97B87Ba93bCA212cbEe48e3210211f03` |

## Oracles

- Skip BTC/USD (Chainlink interface, every block): `0x7b7c000000000000000000000000000000000015` (both nets)
- Pyth: `0x2880aB155794e7179c9eE2e38200202908C17B43` (both nets). Feed IDs: MUSD/USD `0x0617a9b7…c6de`, MEZO/USD `0x80beaaed…826df`, BTC/USD `0xe62df6c8…15b43`.

## x402 (MUSD micropayments)

Facilitator `https://facilitator.vativ.io` (pays gas, both nets). Networks `eip155:31611` / `eip155:31612`. SDK `@x402/evm` ≥ 2.10 (testnet) / 2.15 (mainnet).

## Already built by the community (don't duplicate)

Aurove (liquid veBTC/veMEZO) · Matchbox (veBTC↔veMEZO bribe market) · Vezo (veNFT marketplace) · Range (CL rebalancing vault) · Mezo Tools (MUSD analytics) · veBoost calculator · MezoAgent (chat-to-transact) · Antwyr (explorer tools) · Mezo's own sMUSD Savings Vault.
