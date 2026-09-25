// minia2a SDK — client for minia2a.uk x402 agent microservices
// 1,600+ endpoints. Pay-per-call in USDC on Base via the x402 protocol, or 5 free
// trial calls per signed wallet. No registration, no API key, no credits.
//
// Usage:
//   import { gasPrice, dexPrice } from 'minia2a';
//   const gas = await gasPrice({ chain: 'base' });
//
// Every function throws on HTTP 402 with the x402 challenge attached as `.x402`,
// so a caller that can sign payments (see the `minia2a-client` package) can pay and retry.
//
// 2026-09-12 rewrite (v1.1.0): the previous 1.0.x pointed at top-level paths (`/gas`,
// `/hash`, `/catalog`) that do not exist on the V5 gateway — `/gas` in particular returned
// an HTML landing page with HTTP 200, so gasPrice() silently handed back HTML as if it
// were data. All calls now go to the real `/x402/<service>` routes. Removed: the plaintext
// cross-host fallback (http://99.81.245.60), the retired credits/registration copy, and the
// delisted screenshot service.
//
// 2026-09-25 (v1.1.3): captchaSolve() is a real call again. v1.1.0 had turned it into a
// tombstone reading "delisted — its upstream relay stopped working and it depended on a paid
// third-party key". That was a wrong diagnosis: the relay was never down (the break was a
// firewall on the relay host, fixed 2026-09-16), and `x402-captcha-solve` is live and listed
// at $0.10/call. The false sentence shipped in 1.1.0, 1.1.1 and 1.1.2.

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BASE = (process.env.MINIA2A_URL || 'https://minia2a.uk').replace(/\/+$/, '');
const DOCS_URL = 'https://minia2a.uk/x402-help.html';

// ── Agent identity (optional, first-party only) ──
//
// Every call to minia2a's own gateway may carry a stable, self-chosen agent id, so repeat
// visits are attributable without an account. The server keeps only HMAC(secret, id) —
// the raw value is never stored. See https://minia2a.uk/AGENTS.md#identifying-your-agent
//
// Identity is per-install, not per-process: a fresh id per call would count one agent as
// thousands and inflate the very number this feeds. If the id cannot be persisted
// (read-only home, no env var) we send nothing and stay anonymous — an honest omission
// beats a fabricated agent.
let _agentIdCache;
let _agentIdResolved = false;

function agentId() {
  if (_agentIdResolved) return _agentIdCache;
  _agentIdResolved = true;
  const fromEnv = process.env.MINIA2A_AGENT_ID;
  if (fromEnv) return (_agentIdCache = fromEnv);
  // Two locations exist across our published clients: this one and `minia2a-mcp`,
  // `minia2a-client` and `@minia2a/sdk` read ~/.minia2a-agent-id (the path
  // adoption.go names), while `minia2a-cli` historically wrote
  // ~/.minia2a/agent-id. Reading only one mints a second id on a machine that
  // already has one, and that machine is counted as two agents. Read both.
  const candidates = [
    path.join(os.homedir(), '.minia2a-agent-id'),
    path.join(os.homedir(), '.minia2a', 'agent-id'),
  ];
  // Read and create are separate try blocks on purpose: "file not there yet" is the
  // normal first run and must fall through to creation, not be swallowed as a failure.
  for (const file of candidates) {
    try {
      const existing = fs.readFileSync(file, 'utf8').trim();
      if (existing) return (_agentIdCache = existing);
    } catch (e) { /* not created yet — fall through to the next candidate */ }
  }
  const file = candidates[0];
  try {
    const id = 'agent:' + crypto.randomUUID();
    fs.writeFileSync(file, id, { mode: 0o600 });
    return (_agentIdCache = id);
  } catch (e) {
    return (_agentIdCache = null);
  }
}

// The id identifies us to our own gateway. If BASE is pointed at a mirror or a third
// party (MINIA2A_URL), that host never sees it.
function _isFirstParty(url) {
  try {
    const h = new URL(url).hostname;
    return h === 'minia2a.uk' || h.endsWith('.minia2a.uk');
  } catch (e) {
    return false;
  }
}

function _identityHeaders(url) {
  const id = _isFirstParty(url) ? agentId() : null;
  return id ? { 'X-Agent-ID': id } : {};
}

// ── HTTP helpers ──

// A service call. GET with query params for scalar inputs (the gateway reads the query
// string), POST with a JSON body when any value is an object/array.
async function _call(serviceId, params = {}, opts = {}) {
  const timeout = opts.timeout || 30000;
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  const needsBody = entries.some(([, v]) => typeof v === 'object');
  const headers = { accept: 'application/json', ..._identityHeaders(`${BASE}/x402/${serviceId}`), ...opts.headers };

  let url = `${BASE}/x402/${serviceId}`;
  let body;
  if (needsBody) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(Object.fromEntries(entries));
  } else if (entries.length) {
    url += '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  }

  const res = await fetch(url, { method: needsBody ? 'POST' : 'GET', headers, body, signal: AbortSignal.timeout(timeout) });

  if (res.status === 402) {
    const err = new Error(`x402 payment required for ${serviceId} — pay in USDC on Base, or use a free trial call (5 per signed wallet). See ${DOCS_URL}`);
    err.status = 402;
    err.x402 = await res.json().catch(() => null);
    err.docsUrl = DOCS_URL;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`minia2a ${serviceId} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function _get(route, opts = {}) {
  const url = `${BASE}${route}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', ..._identityHeaders(url), ...opts.headers },
    signal: AbortSignal.timeout(opts.timeout || 30000),
  });
  if (!res.ok) throw new Error(`minia2a ${route} ${res.status}`);
  return res.json();
}

// Exported services that were delisted or never existed on V5. Kept as named exports so
// existing code fails loudly with a real reason instead of a confusing 404.
function _gone(name, reason) {
  return async function gone() { throw new Error(`minia2a.${name} is no longer available — ${reason}`); };
}

// ── CAPTCHA ──

// Live, priced, and NOT trialable: it spends a prepaid anti-captcha balance, so the gateway
// never issues a free trial for it — expect a 402 with the x402 challenge, and a trial call
// will not be accepted. Inputs are validated here before the request because the service
// answers `{ok:false}` to a missing sitekey, and repeated `ok:false` deliveries are what gets
// a service delisted.
async function captchaSolve({ sitekey, url, type = 'v2' } = {}) {
  if (!sitekey || !url) throw new Error('sitekey and url required');
  return _call('x402-captcha-solve', { sitekey, url, type });
}

// ── CRYPTO DATA ──

async function gasPrice({ chain } = {}) { return _call('x402-gas', { chain }); }
async function dexPrice({ chain = 'base', address, symbol } = {}) {
  if (!address && !symbol) throw new Error('address or symbol required');
  return _call('x402-dex-price', { chain, address, symbol });
}
async function tokenSearch(q) { return _call('x402-token-search', { q }); }
async function walletIntel({ address } = {}) {
  if (!address) throw new Error('address required');
  return _call('x402-wallet-intel', { address });
}
async function polymarket({ event, q, limit } = {}) { return _call('x402-polymarket', { q: event || q, limit }); }
async function chainInfo({ chain } = {}) { return _call('x402-chain-info', { chain }); }
async function cryptoPrice({ symbol } = {}) { return _call('x402-crypto-price', { symbol }); }

// ── WEB AUTOMATION ──

async function screenshot() { throw new Error('minia2a.screenshot is no longer available — delisted (headless Chromium is too memory-heavy for this host). Use an external screenshot API.'); }
async function fetchPage({ url }) {
  if (!url) throw new Error('url required');
  return _call('x402-browser-scrape', { url }, { timeout: 60000 });
}
async function web2md({ url }) {
  if (!url) throw new Error('url required');
  return _call('x402-web2md', { url });
}

// ── UTILITIES ──

async function hash({ text, algo = 'sha256' }) { return _call('x402-hash', { text, algo }); }
async function jsonValidate(json) { return _call('x402-json-validate', { json }); }
async function dnsLookup({ domain, type = 'A' }) {
  if (!domain) throw new Error('domain required');
  return _call('x402-dns', { domain, types: type });
}
async function ipLookup({ ip } = {}) { return _call('x402-ip-report', { ip }); }

// ── EMAIL ──

async function emailSend({ to }) { return _call('x402-email', { email: to }); }

// ── BLOCKCHAIN TOOLS ──

async function tokenSecurity({ address, chain = 'base' } = {}) {
  if (!address) throw new Error('address required');
  return _call('x402-token-security', { address, chain });
}
async function txDecode({ hash, chain = 'base' } = {}) { return _call('x402-tx-decode', { tx: hash, chain }); }
async function abiLookup({ address, chain = 'base' } = {}) {
  if (!address) throw new Error('address required');
  return _call('x402-abi-lookup', { address, chain });
}
async function contractCheck({ address, chain = 'base' } = {}) {
  if (!address) throw new Error('address required');
  return _call('x402-contract-scan', { address, chain });
}
const approvalCheck = _gone('approvalCheck', 'no token-approval service exists on V5');

// ── AGENT / ECOSYSTEM ──

async function webSearch({ q, max } = {}) { return _call('x402-web-search', { q, max }); }
async function briefing({ topic, q } = {}) { return _call('x402-ai-briefing', { topic: topic || q }); }
async function githubTrending() { return _call('x402-github-trending'); }
async function hackerNews() { return _call('x402-hn-top'); }
async function npmInfo(pkg) { return _call('x402-npm-package-info', { name: pkg }); }
async function currencyRates({ base, to } = {}) { return _call('x402-forex', { base, to }); }
async function trending() { return _call('x402-crypto-trending'); }
async function sentiment({ text } = {}) { return _call('x402-sentiment', { text }); }
async function csvJson({ data, direction = 'csv-to-json' } = {}) {
  return direction === 'csv-to-json' ? _call('x402-csv-json', { csv: data }) : _call('x402-csv-build', { json: data });
}
async function textDiff({ text1, text2 } = {}) { return _call('x402-difference', { a: text1, b: text2 }); }
async function dataStats({ numbers } = {}) { return _call('x402-stats', { numbers }); }
const batch = _gone('batch', 'no batch endpoint exists on V5; call the services directly');

// ── INFO ──

async function listServices() { return _get('/api/services'); }
async function health() {
  try { return await _get('/health', { timeout: 10000 }); } catch { return { status: 'down' }; }
}

module.exports = {
  captchaSolve,
  gasPrice, dexPrice, tokenSearch, walletIntel, polymarket, chainInfo, cryptoPrice,
  screenshot, fetchPage, web2md,
  hash, jsonValidate, dnsLookup, ipLookup,
  emailSend,
  tokenSecurity, txDecode, abiLookup, contractCheck, approvalCheck,
  webSearch, briefing, githubTrending, hackerNews, npmInfo,
  currencyRates, trending, sentiment, csvJson, textDiff, dataStats, batch,
  listServices, health,
  BASE, DOCS_URL,
  agentId,
};
