# minia2a-kit

**Memory, discovery and knowledge for AI agents** — pay-per-call via [x402](https://x402.org), settled in USDC on Base. No API keys, no subscriptions, no KYC. **Bring a wallet.**

Four primitives an agent needs that it can't get from its own LLM:

| Method | What it gives you | Price |
|---|---|---|
| `findService(query)` | Semantic search over **1,600+ live x402 services** — "what service does captcha solving / token price / web scraping?" | $0.50 |
| `recall(query)` | Answers from the **agent-economy knowledge base** (x402, agent payments, the marketplace) | $0.50 |
| `store(content)` | **Persistent memory across calls** — save a fact, get an id to reference later | $0.50 |
| `webSearch(query)` | Web search with structured results | $0.01 |

Built on the [minia2a](https://minia2a.uk) marketplace — the same services agents discover and pay for there, wrapped for direct use in your own code or CLI.

## Install

```bash
npm install minia2a-kit
```

## CLI

```bash
export MINIA2A_PRIVATE_KEY=0x...   # wallet pays per-call USDC, never sent anywhere

minia2a-kit find "captcha solve"
minia2a-kit recall "how does x402 settlement work"
minia2a-kit store "meeting notes: signed Base grant application"
minia2a-kit search "latest agent economy news"
```

## Library

```js
import { createClient } from "minia2a-kit";
const kit = createClient(process.env.MINIA2A_PRIVATE_KEY);

// Find the right service for a task
const { results } = await kit.findService("captcha solve");
// → [{ id: "x402-captcha-solve", name: "Captcha Solve", ... }, ...]

// Ask the knowledge base
const { results } = await kit.recall("x402 settlement");

// Persist a memory, get an id
const { id } = await kit.store("wallet for staging: 0x64ac…");

// Web search
const { results } = await kit.webSearch("AI agents paying each other");
```

## Why

An agent's own LLM can format, reason, and write — but it can't remember across runs, can't know which of 1,600+ paid services solves a given task, and can't see the current web. These four calls cover that gap, each pay-per-call with no subscription.

Powers: agent onboarding ("find a service that does X"), persistent agent memory, market research, and task→tool routing.

## Payment

Payments use the [x402](https://x402.org) protocol: your wallet signs an exact-permit2 payment in USDC on Base; the facilitator settles it; minia2a delivers the result. No wallet data ever leaves your process — the key only signs locally.

Built on [minia2a.uk](https://minia2a.uk) — the x402 marketplace: 1,600+ pay-per-call APIs for AI agents, including crypto data, web scraping, AI inference, and security.
