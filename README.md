# minia2a

**Agent-to-agent API marketplace** — 1,600+ pay-per-call x402 services that AI agents discover, call, and pay for in USDC on Base. No API keys, no subscriptions, no KYC. Bring a wallet; pay per call via [x402](https://x402.org) (HTTP 402 Payment Required).

**Site:** https://minia2a.uk · **Docs:** https://minia2a.uk/docs · **Catalog:** https://minia2a.uk/api/services

---

## What is this repository?

This is the **open-source surface** of minia2a: client SDKs, protocol standards, and docs that let any agent or developer integrate with the marketplace. **The marketplace engine itself is proprietary and not open-sourced** — that is deliberate (see below).

| Part | Open source? | Where |
|---|---|---|
| Client SDKs (call & pay for services) | ✅ | npm packages below |
| x402 payment-security checklist (standard) | ✅ | [x402-payment-security-checklist](https://github.com/minia2auk/x402-payment-security-checklist) |
| MCP server package | ✅ | [minia2a-mcp](https://github.com/minia2a/minia2a-mcp) (`npx -y minia2a-mcp`) |
| Audit methodology (public) | ✅ | [minia2a.uk audit methodology](https://minia2a.uk/x402-payment-audit-methodology.html) |
| Marketplace engine (gateway, audit engine, probe logic) | ❌ **proprietary** | — |

**Why the engine is closed:** the audit/probe engines are the product's moat. Open-sourcing them would let anyone re-run paid black-box checks for free and commoditize the trust layer. Clients stay open so *using* the platform is fully transparent.

## Client SDKs (npm)

Every SDK is a thin client: it calls a minia2a service and **pays per call** in USDC on Base via x402. Your private key never leaves your process.

| Package | What it does | Price per call |
|---|---|---|
| [`minia2a-client`](https://www.npmjs.com/package/minia2a-client) | Discovery + generic service calls | varies |
| [`minia2a-kit`](https://www.npmjs.com/package/minia2a-kit) | Agent memory / discovery / knowledge tools | per service |
| [`minia2a-audit`](https://www.npmjs.com/package/minia2a-audit) | Smart-contract audit (`auditStatic` $2, `auditAI` $20) | $2–$20 |
| [`minia2a-payment-audit`](https://www.npmjs.com/package/minia2a-payment-audit) | x402 endpoint trust check before you pay a seller (`trustCheck`, $5) | $5 |
| [`minia2a-mcp`](https://www.npmjs.com/package/minia2a-mcp) | MCP server for tool-based discovery inside Claude Code / Cursor / Windsurf | per service |

## Quick start

```bash
npm install minia2a-audit
export MINIA2A_PRIVATE_KEY=0x...

# Audit a contract (pays $2 or $20 USDC on Base)
minia2a-audit static ./Contract.sol
minia2a-audit ai ./Contract.sol

# Before you pay an x402 seller, check it actually verifies payment (pays $5)
npm install minia2a-payment-audit
minia2a-payment-audit check https://example.com/x402/time
```

Or call any of 1,600+ services directly over x402 — register a wallet for 5 free trial calls:

```bash
# Register (sign "minia2a register: <wallet>" with EIP-191)
curl -X POST https://minia2a.uk/api/v1/register-simple \
  -H "content-type: application/json" \
  -d '{"name":"my-agent","wallet":"0x...","signature":"0x..."}'

# Call a service with trial headers, or pay the 402
curl -s https://minia2a.uk/x402/gas-price?probe=1   # inspect price without spending
```

## Protocol & discovery footprint

minia2a implements the agent-ready stack so any AI agent can find and use it:

- **x402** payment (USDC on Base, multi-facilitator) — standard 402 challenges
- **A2A Agent Card** — `/.well-known/agent-card.json`
- **Agent Skills** — `/.well-known/agent-skills/index.json` (4 SKILL.md tutorials)
- **Web Bot Auth** — `/.well-known/http-message-signatures-directory` (Ed25519 JWKS)
- **DNS-AID** — `_a2a/_mcp/_index._agents.minia2a.uk` SVCB records, DNSSEC
- **MCP** — `POST https://minia2a.uk/mcp` (streamable-http) + AI Search MCP
- **llms.txt / agents.txt / robots content-signals**

## The x402 payment-security standard

We audit x402 resource integrations (sellers) — verification bypass, replay, race, allowance, fund safety. See the [checklist](https://github.com/minia2auk/x402-payment-security-checklist) (v2, 6 risk categories) and our [methodology](https://minia2a.uk/x402-payment-audit-methodology.html). The same standard powers our paid checks: `x402-payment-audit` ($5 black-box, buyer-side) and `x402-integration-audit` ($50 white-box, seller-side).

## Marketplace audit product line

| Service | Price | Who it's for |
|---|---|---|
| `smart-contract-audit` | $2 | Contract static scan |
| `ai-audit` | $20 | Contract AI deep audit |
| `payment-audit` | $5 | Buyers — is the endpoint you're paying SAFE? (black-box) |
| `integration-audit` | $50 | Sellers — audit your x402 integration (white-box) |

## License

MIT (this repo — the open-source surface). The minia2a marketplace engine is not part of this repository.
