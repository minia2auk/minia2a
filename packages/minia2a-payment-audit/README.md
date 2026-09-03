# minia2a-payment-audit

**x402 payment trust check for AI agents** — pay-per-call via [x402](https://x402.org), settled in USDC on Base. No API keys, no subscriptions, no KYC. **Bring a wallet.**

Before you pay an x402 seller for an API result, ask: *does that endpoint actually verify my payment — or does it deliver results to anyone who asks?* If the latter, you pay and a free-rider gets the same answer for nothing, and the seller loses money serving you. This package runs a **black-box probe** (on minia2a's side) against the endpoint you plan to pay:

| Verdict | Meaning |
|---|---|
| **SAFE** | Rejects forged txHash, forged signature, and replayed payments before delivering |
| **RISK** | Delivered results for a forged/replayed payment header — you'd be paying for something others get free |
| **NOT_X402** | Not an x402 payment endpoint |

**Honest limits**: this is a black-box trust check, not a full audit. It cannot detect pay-then-no-delivery (endpoint takes your money and never returns a result) or internal logic flaws — that needs a code review (see the [x402 payment security checklist](https://github.com/minia2auk/x402-payment-security-checklist)). The probe logic runs server-side and is not open-sourced.

## Install

```bash
npm install minia2a-payment-audit
```

## CLI

```bash
export MINIA2A_PRIVATE_KEY=0x...
minia2a-payment-audit check https://example.com/x402/time
```

## Library

```js
import { createPaymentAuditClient } from "minia2a-payment-audit";

const client = createPaymentAuditClient(); // or pass key: createPaymentAuditClient("0x...")
const r = await client.trustCheck("https://example.com/x402/time");
// { ok: true, verdict: "SAFE" | "RISK" | "NOT_X402", safe, risks, summary,
//   tests: { payTo, amount, network, fake_tx, fake_sig, replay }, ... }
```

## How it works

1. You give it the URL of the x402 endpoint you plan to pay.
2. minia2a probes it: baseline 402 structure, forged txHash, forged signature, replayed payment.
3. If the endpoint rejects all forged/replayed payments and only delivers after real verification → **SAFE**. If it delivers on a forged header → **RISK**.
4. Your wallet pays **$5 USDC on Base** via x402 for the check (0% platform fee through 2026).

Env: `MINIA2A_PRIVATE_KEY` (payer wallet), `MINIA2A_BASE` (default `https://minia2a.uk`).
