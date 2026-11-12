Wave 2: Tiller went from a one-way testnet drill to a two-way peg defender that a new user can join in 30 seconds. Everything is live on Mezo testnet and open source.

Against our declared Wave 2 goals:
- Two-way peg defence: DONE. Below $1 by Mezo redemption or mUSDC buyback; above $1.005 by selling MUSD for mUSDC on Mezo's MUSD/mUSDC pool (instead of minting from a vault trove)
- Multi-trove redemptions, sized correctly: DONE (up to 50 troves, sized by simulating the vault call on Mezo's live contracts)
- Telegram bot: DONE, @tillerfinancebot
- Fuzz/invariant tests and a timelock: DONE
- Mainnet with a deposit cap: READY, NOT DEPLOYED. Script, Mezo mainnet addresses, 5,000 MUSD cap and 48h timelock are in the repo; we hold it back until an audit
- sMUSD and LP sleeves: NOT DONE (no testnet sMUSD); the mUSDC sleeve shipped instead

What shipped:
1. Vault v4 (0xA300F55877873D7881B1B00eacec299b3C7b8a69): new hard limits (30% mUSDC cap, $1.005 sell floor, $1.00 buy ceiling, deposit cap), trades only on Mezo's own pools, admin behind an OpenZeppelin timelock; pausing never blocks withdrawals.
2. Real depeg: Mezo's MUSD/BTC testnet pool hit $0.94; the keeper's simulation showed 299 MUSD → +15.67 MUSD (5.2%). Claude reviews every move and fails closed.
3. Testing: 18 unit tests plus a randomised invariant test (200 seeds × 60 steps) that caught a real last-holder rounding bug before deploy; Synpress + MetaMask end-to-end QA against the live site.
4. Onboarding and traction: a one-click faucet (100 test MUSD + gas, no trove needed), the Peg Defenders leaderboard with share cards, and public on-chain stats.
5. Always on: a Cloudflare Worker runs the keeper every 10 minutes, serves the stats and answers the Telegram bot.

Links:
- Walkthrough video: https://youtu.be/rTYEYR9QF_s
- App: https://tillerfinance.xyz/app
- Live stats: https://tillerfinance.xyz/stats
- Leaderboard: https://tillerfinance.xyz/app/leaderboard
- Code and changelog: https://github.com/fahmmin/tiller-finance
- Telegram: https://t.me/tillerfinancebot
