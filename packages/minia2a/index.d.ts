// TypeScript definitions for the minia2a SDK (v1.1.2)
//
// Every function resolves with the service's JSON payload, or rejects on HTTP 402 with
// an `X402Error` carrying the payment challenge — sign a payment with `minia2a-client`
// (or use a free trial call) and retry.

export interface X402Error extends Error {
  status: 402;
  x402: unknown;
  docsUrl: string;
}

/** Base URL in use (override with the MINIA2A_URL env var). */
export const BASE: string;
/** Human-facing docs for the x402 payment flow. */
export const DOCS_URL: string;

/**
 * The stable per-install agent id this client sends as `X-Agent-ID` on first-party calls,
 * or `null` when none could be persisted (read-only home) — in which case no header is sent.
 * Resolution order: `MINIA2A_AGENT_ID` env var, then `~/.minia2a-agent-id`, then a freshly
 * generated `agent:<uuid>` written there with mode 0600. The id is never sent to a host
 * other than minia2a.uk, so pointing `MINIA2A_URL` at a mirror does not leak it.
 */
export function agentId(): string | null;

// ── Captcha ──
/**
 * Solve reCAPTCHA v2/v3, hCaptcha or Cloudflare Turnstile. $0.10/call, USDC on Base.
 * No free trial — this one spends a prepaid solver balance, so every call is a paid call.
 * Throws if `sitekey` or `url` is missing; throws with `.x402` set on HTTP 402.
 */
export function captchaSolve(opts: { sitekey: string; url: string; type?: string }): Promise<any>;

// ── Crypto data ──
export function gasPrice(opts?: { chain?: string }): Promise<any>;
export function dexPrice(opts: { chain?: string; address?: string; symbol?: string }): Promise<any>;
export function tokenSearch(q: string): Promise<any>;
export function walletIntel(opts: { address: string }): Promise<any>;
export function polymarket(opts?: { event?: string; q?: string; limit?: number }): Promise<any>;
export function chainInfo(opts?: { chain?: string }): Promise<any>;
export function cryptoPrice(opts?: { symbol?: string }): Promise<any>;

// ── Web automation ──
/** Always rejects — the screenshot service was delisted (Chromium is too memory-heavy for this host). */
export function screenshot(): Promise<never>;
export function fetchPage(opts: { url: string }): Promise<any>;
export function web2md(opts: { url: string }): Promise<any>;

// ── Utilities ──
export function hash(opts: { text: string; algo?: string }): Promise<any>;
export function jsonValidate(json: unknown): Promise<any>;
export function dnsLookup(opts: { domain: string; type?: string }): Promise<any>;
export function ipLookup(opts?: { ip?: string }): Promise<any>;

// ── Email ──
export function emailSend(opts: { to: string }): Promise<any>;

// ── Blockchain tooling ──
export function tokenSecurity(opts: { address: string; chain?: string }): Promise<any>;
export function txDecode(opts: { hash?: string; chain?: string }): Promise<any>;
export function abiLookup(opts: { address: string; chain?: string }): Promise<any>;
export function contractCheck(opts: { address: string; chain?: string }): Promise<any>;
/** Always rejects — no token-approval service exists on V5. */
export function approvalCheck(): Promise<never>;

// ── Agent / ecosystem ──
export function webSearch(opts?: { q?: string; max?: number }): Promise<any>;
export function briefing(opts?: { topic?: string; q?: string }): Promise<any>;
export function githubTrending(): Promise<any>;
export function hackerNews(): Promise<any>;
export function npmInfo(pkg: string): Promise<any>;
export function currencyRates(opts?: { base?: string; to?: string }): Promise<any>;
export function trending(): Promise<any>;
export function sentiment(opts?: { text?: string }): Promise<any>;
export function csvJson(opts?: { data?: unknown; direction?: 'csv-to-json' | 'json-to-csv' }): Promise<any>;
export function textDiff(opts?: { text1?: string; text2?: string }): Promise<any>;
export function dataStats(opts?: { numbers?: number[] }): Promise<any>;
/** Always rejects — no batch endpoint exists on V5. */
export function batch(): Promise<never>;

// ── Info ──
export function listServices(): Promise<any>;
export function health(): Promise<any>;
