# minia2a-audit

Smart-contract audit for AI agents — pay-per-call via [x402](https://x402.org), settled in USDC on Base. No API keys, no subscriptions, no KYC. **Bring a wallet.**

Two tiers, both live on the [minia2a](https://minia2a.uk) marketplace:

| | `auditStatic` | `auditAI` |
|---|---|---|
| Price | **$2 / call** | **$20 / call** |
| What | Deterministic static scan | AI deep audit |
| Patterns | 10: reentrancy, access-control, integer-overflow, unvalidated-call, tx.origin, delegatecall, selfdestruct, block.timestamp, assert-misuse, owner-change | business-logic, economic, cross-contract flaws (owner-uninitialized, account-confusion, signer-auth) |
| Sampling | — | 3x sampled, deduplicated, best-result |
| Languages | solidity | solidity, rust (Solana), move |
| Best for | fast pre-check, known patterns | new/small contracts needing a suspicious-points list |

> **Honest limits**: AI audit is probabilistic — it may miss vulnerabilities or report non-issues. Treat output as guidance for manual review, not as proof or a substitute for a professional audit. The service says so in its own disclaimer; we do too.

## Install

```bash
npm install minia2a-audit
```

## CLI

```bash
# $2 static scan
minia2a-audit static ./contract.sol

# $20 AI deep audit
minia2a-audit ai ./contract.sol --language solidity
minia2a-audit ai ./program.rs --language rust

# wallet pays the fee — never sent anywhere, only signs locally
export MINIA2A_PRIVATE_KEY=0x...
```

## Library

```js
import { createAuditClient } from "minia2a-audit";

const audit = createAuditClient(process.env.MINIA2A_PRIVATE_KEY);

// $2 static scan
const r1 = await audit.auditStatic(sourceCode);

// $20 AI deep audit (rust for Solana)
const r2 = await audit.auditAI(sourceCode, { language: "rust" });
```

Returns `{ ok: true, findings: [...], risk: "high", ... }` on success, or `{ ok: false, status, error }`.

## Why

Smart-contract auditing is the one coding vertical where "verification is attribution" — a finding is only worth money if it reproduces. minia2a's audit services ship a deterministic $2 pre-check and an AI deep pass, so an agent can cheaply decide whether a contract is worth a deeper (manual) review — then go do that with the findings in hand.

For the fully-verified, PoC-reproduced deep reports (the $200–$1000 tier with forge PoCs), the audit-agent-mvp project handles those as a manual/async deliverable — this package covers the two agent-automatable tiers.

## Payment

Payments go through the [x402](https://x402.org) protocol: your wallet signs an exact-permit2 payment in USDC on Base; the Coinbase facilitator settles it; minia2a delivers the audit. `spendControls` are disabled so the $20 tier is payable (the x402 SDK defaults to a $1/call cap).

Built on [minia2a.uk](https://minia2a.uk) — the x402 marketplace. Other services: crypto data, web scraping, AI inference, security, and more.
