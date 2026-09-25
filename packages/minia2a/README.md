# minia2a

Client SDK for [minia2a.uk](https://minia2a.uk) — **1,600+ x402 agent microservices**. Crypto data, web scraping, blockchain tooling, utilities.

Pay-per-call in **USDC on Base** via the [x402](https://minia2a.uk/x402-help.html) protocol, or get **5 free trial calls per signed wallet**. No registration, no API key, no prepaid balance.

## Install

```bash
npm install minia2a
```

## Quickstart

```js
import { gasPrice, dexPrice, web2md } from 'minia2a';

// Gas prices across chains
const gas = await gasPrice({ chain: 'base' });

// Token price on a DEX
const price = await dexPrice({
  chain: 'base',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
});

// Clean markdown from any URL
const md = await web2md({ url: 'https://example.com' });
```

## Paying

Every call either succeeds, or rejects with the x402 challenge attached:

```js
try {
  const gas = await gasPrice();
} catch (e) {
  if (e.status === 402) {
    console.log(e.x402);   // the payment challenge (accepts[], amount, asset, payTo)
    console.log(e.docsUrl); // how to pay
  }
}
```

To sign payments automatically, use the companion package [`minia2a-client`](https://www.npmjs.com/package/minia2a-client) — it holds a wallet, signs the x402 authorization, and retries. This package stays wallet-free by design: it never touches a private key.

**Free trials:** any signed wallet gets 5 trial calls, no registration. See [x402-help.html](https://minia2a.uk/x402-help.html).

## Agent identity (optional)

Every call to minia2a.uk carries `X-Agent-ID` so repeat visits are attributable without an account. The id is per-install, not per-call — a fresh id per call would count one agent as thousands.

Resolution order:

1. `MINIA2A_AGENT_ID` (env var, used verbatim)
2. `~/.minia2a-agent-id` (read if present)
3. generated as `agent:<uuid>` and written there with mode `0600`

If the id cannot be persisted — read-only home and no env var — **no header is sent** and the call stays anonymous. An honest omission beats a fabricated agent. The server keeps only `HMAC-SHA256(secret, id)`; the raw value is never stored. It is an attribution channel, never a gate: access, price and trial quota are identical with or without it.

The header is only attached to `minia2a.uk`. If you set `MINIA2A_URL` to a mirror or your own proxy, that host never sees it.

```js
import { agentId } from 'minia2a';
console.log(agentId()); // 'agent:…' or null
```

## API

| Function | Service |
|---|---|
| `captchaSolve({sitekey,url,type})` | Solve reCAPTCHA / hCaptcha / Turnstile — $0.10/call, no free trial |
| `gasPrice({chain})` | Gas across chains |
| `dexPrice({chain,address,symbol})` | DEX token price |
| `cryptoPrice({symbol})` | Spot price |
| `tokenSearch(q)` | Token lookup |
| `walletIntel({address})` | On-chain wallet profile |
| `polymarket({event,q,limit})` | Prediction-market data |
| `chainInfo({chain})` | Chain metadata |
| `fetchPage({url})` | Scrape a page |
| `web2md({url})` | Page → markdown |
| `hash({text,algo})` | Hash a string |
| `jsonValidate(json)` | Validate JSON |
| `dnsLookup({domain,type})` | DNS records |
| `ipLookup({ip})` | IP report |
| `emailSend({to})` | Email check |
| `tokenSecurity({address,chain})` | Token risk |
| `txDecode({hash,chain})` | Decode a transaction |
| `abiLookup({address,chain})` | Contract ABI |
| `contractCheck({address,chain})` | Contract scan |
| `webSearch({q,max})` | Web search |
| `briefing({topic})` | AI briefing |
| `githubTrending()` | GitHub trending |
| `hackerNews()` | HN top stories |
| `npmInfo(pkg)` | npm package info |
| `currencyRates({base,to})` | FX rates |
| `trending()` | Crypto trending |
| `sentiment({text})` | Sentiment score |
| `csvJson({data,direction})` | CSV ⇄ JSON |
| `textDiff({text1,text2})` | Text diff |
| `dataStats({numbers})` | Numeric stats |
| `listServices()` | Full catalog (free) |
| `health()` | Platform status (free) |

### No longer available

These throw with a reason rather than failing obscurely — the underlying services were delisted or never existed on V5:

`screenshot()` · `approvalCheck()` · `batch()`

## Version notes

- **1.1.3** — `captchaSolve()` is a real call again. 1.1.0 had turned it into a tombstone reading *"delisted — its upstream relay stopped working and it depended on a paid third-party key"*. **That was a wrong diagnosis**, and it shipped in 1.1.0, 1.1.1 and 1.1.2: the relay was never down (the break was a firewall on the relay host, fixed 2026-09-16) and `x402-captcha-solve` is live, listed and priced. It is **$0.10/call with no free trial** — the service spends a prepaid solver balance, so the gateway never issues a trial for it. Missing `sitekey`/`url` throws locally rather than round-tripping a request the service would reject.
- **1.1.2** — calls to minia2a.uk now carry `X-Agent-ID` (see *Agent identity* above). Previously the npm package sent no identity header at all, so agents using it were invisible to the platform's adoption count while agents using the browser SDK or the MCP server were counted. New export: `agentId()`. No other behaviour change.
- **1.1.1** — `repository` pointed at a deleted org; now `minia2auk/minia2a`. No code change.
- **1.1.0** — every call now targets the real `/x402/<service>` routes. Previously (1.0.x) the SDK called top-level paths that don't exist on the V5 gateway; `/gas` returned an HTML landing page with HTTP 200, so `gasPrice()` silently handed back HTML as if it were data. Also removed: a plaintext cross-host fallback (`http://99.81.245.60`), the retired credits/registration copy, and the captcha/screenshot implementations (both *believed* delisted at the time; the captcha one was not — see 1.1.3). No exported function was removed.

## License

MIT
