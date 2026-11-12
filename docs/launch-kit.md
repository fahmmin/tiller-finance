# Launch kit: getting real testnet users

Post these yourself, in your own voice. Edit freely. Check Mezo's X handle before tagging; `@MezoNetwork` is unverified.

## X thread

**1/**
MUSD is Bitcoin-backed and redeemable for $1 of BTC. But that floor only holds if someone actually buys MUSD back when it slips.

Tiller turns that job into a savings account. Live on Mezo testnet today 🧵
tillerfinance.xyz

**2/**
Deposit MUSD. When MUSD trades under $1, the vault redeems it with Mezo for $1 of BTC, sells the BTC back for more MUSD and keeps the difference.

Above $1 it sells MUSD, and at $1 or less it buys it back. Between depegs it backs Mezo's Stability Pool.

**3/**
A rule-based keeper plans every move. Claude reviews it and can veto it, never start one. The contract enforces the rest: the trade must profit, BTC can't sell under the oracle, withdrawals never pause, and admin changes wait in a timelock.

Every move is logged on-chain with a plain-English reason.

**4/**
Try it in 30 seconds, no Mezo setup needed:
1. Connect a wallet at tillerfinance.xyz/app/earn
2. Click "Get 100 test MUSD + gas"
3. Deposit, and claim your spot on the Peg Defenders leaderboard

tillerfinance.xyz/app/leaderboard

**5/**
Everything is public: live stats at tillerfinance.xyz/stats, code at github.com/fahmmin/tiller-finance, and a Telegram bot that answers "why did my vault do that?" at t.me/tillerfinancebot.

Built for the Mezo Buildathon. Feedback very welcome.

## Mezo Discord (builders / showcase channel)

> Hey all, I'm building **Tiller Finance** for the Buildathon: a MUSD vault that earns by defending the $1 peg, buying MUSD back below $1 through Mezo redemptions and selling above it, with Claude reviewing every keeper move.
>
> It's on testnet, and I'd love people to break it. There's a one-click faucet (100 test MUSD + gas), so you don't need to open a trove first:
> 1. tillerfinance.xyz/app/earn → connect → "Get 100 test MUSD + gas"
> 2. Deposit → you're on the Peg Defenders board
> 3. Ask the bot anything: t.me/tillerfinancebot
>
> Live numbers: tillerfinance.xyz/stats. Bugs and UX gripes are just as welcome as deposits 🙏

## Telegram / group chats

> Testing a Bitcoin-backed stablecoin vault on Mezo testnet. Takes 30 seconds, free test money, no setup: tillerfinance.xyz/app/earn. Would really help me out, and tell me what's confusing!

## Direct message (best conversion: send 20–30 of these)

> Hey [name]! I built a stablecoin vault for the Mezo Buildathon and need real testers before judging. Could you try it? It takes 30 seconds: connect a wallet at tillerfinance.xyz/app/earn, hit "Get 100 test MUSD", deposit. Honest feedback is gold. Thank you!

## Where to post

- Mezo Discord: showcase / builders channels, and the Buildathon channel on AKINDO
- X: the thread above, then quote-post your own leaderboard card
- Crypto dev and hackathon Telegram groups you're already in
- Friends and classmates via DM. In three days, personal asks beat everything else.

Don't use bought views, airdrop farms or your own extra wallets. Judges can read every wallet on the explorer.
