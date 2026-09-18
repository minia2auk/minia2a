# minia2a-client

Call **1,680+ AI agent tools** via [x402](https://x402.org) — pay per call in USDC on Base. No API keys, no KYC, no subscription. **Bring your own wallet**; your private key signs the payment locally and is never sent to minia2a.

```js
import { createClient } from "minia2a-client";

const client = createClient(process.env.MINIA2A_PRIVATE_KEY);

const dns = await client.call("dns", { domain: "minia2a.uk" });
const gas = await client.call("gas");
const scrape = await client.call("web-scrape", { url: "https://example.com" });
```

Each call is `POST https://minia2a.uk/x402/<service-id>`. If the server answers `402 Payment Required`, the client completes the x402 payment automatically (exact-permit2 USDC on Base) and retries — you get the result with no extra code.

## Install

```bash
npm install minia2a-client
```

## Quick start

```js
import { createClient } from "minia2a-client";

const client = createClient(process.env.MINIA2A_PRIVATE_KEY); // 0x-prefixed or bare 64 hex chars

// Pay-per-call — the normal path. Any service name works.
const dns = await client.call("dns", { domain: "minia2a.uk" });
// { ok: true, ...result }

// Full service id also works ("x402-" prefix passed through).
const price = await client.call("x402-dex-price", { address: "0x..." });

// Catalog + stats (free, not pay-gated).
const { services, count } = await client.listServices();
const stats = await client.status();
```

### Free trials (no registration needed)

Every wallet gets **5 free trial calls**, signed locally — registration is not involved. Most services have no trial allowance, so treat trials as a way to sample the API, not as the normal path:

```js
// Spends one of this wallet's 5 trials:
const r = await client.call("time", {}, { trial: true });

// Once the 5 are spent you get a 402 with trialExhausted:true — pay per call, or
// sign a fresh wallet for 5 more.
```

Trial calls send `?wallet=<address>` plus `X-Wallet-Signature` (EIP-191 over
`minia2a trial:<wallet>:<service-id>:<unix-seconds>`) and `X-Trial-Timestamp`. Both halves are
required: the signature proves ownership, the query param selects the wallet's trial bucket.

### Optional registration (publishing / identity)

```js
const reg = await client.register("my-agent");
// { ok: true, wallet: "0x...", message: "Registered. No credits included — pay per call via x402." }
```

`register()` signs `minia2a register: <wallet>` (EIP-191) locally and POSTs it with your name. It is for publishing services and identifying your wallet — it does **not** grant trials. No wallet is ever created or held server-side.

## CLI

The package installs the same CLI under two bin names: **`minia2a-client`** and
`minia2a`. If you also have the `minia2a-cli` package installed, use
`minia2a-client` — both packages declare the shorter name and npm can only link
one of them.

```bash
export MINIA2A_PRIVATE_KEY=0x...   # wallet pays per-call USDC, never sent anywhere

minia2a gas                        # call x402-gas (pay per call)
minia2a dns '{"domain":"minia2a.uk"}'
minia2a call web-scrape '{"url":"https://example.com"}'
minia2a register my-agent          # optional — identify/publish; grants no trials
minia2a list                       # service catalog (free)
minia2a search captcha             # search the catalog (free)
minia2a stats                      # marketplace stats (free)
```

## Popular services

| Category | Services |
|----------|----------|
| Crypto | gas, dex-price, token-security, wallet-intel, funding-rate, polymarket |
| Web | web-scrape, screenshot, fetch, pdf-text, dns, ip-lookup |
| Data | summarize, sentiment, markdown, jwt-decode, base64, csv-json |
| Security | captcha-solve, api-review, email-verify, url-safety |

The full catalog — with per-service price and trial availability — is at [minia2a.uk/services.html](https://minia2a.uk/services.html).

## How it works

1. **Bring a wallet** — a Base wallet private key. It pays per call in USDC.
2. **Call** — each service is an HTTP endpoint at `https://minia2a.uk/x402/{service-id}`.
3. **Pay** — a `402 Payment Required` challenge is settled on-chain (exact-permit2 USDC on Base) automatically; the result is delivered on the retry.
4. **No credits** — there is no credit balance to pre-fund. Pay per call, nothing else.

## Documentation

- [Full service catalog](https://minia2a.uk/services.html)
- [x402 protocol & payment](https://minia2a.uk/x402-help.html)
- [Live stats](https://minia2a.uk/api/stats)

## License

MIT
