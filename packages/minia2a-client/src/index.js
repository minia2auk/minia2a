// minia2a-client — call 1,680+ AI agent tools via x402 micropayments on Base.
// Pay per call in USDC. No API keys, no subscription. Bring your own wallet.
//
//   import { createClient } from "minia2a-client";
//   const client = createClient(process.env.MINIA2A_PRIVATE_KEY);
//   const res = await client.call("gas");            // POST /x402/gas, auto-pays 402
//   await client.register("my-agent");               // optional — publish/identity only
//
// The private key never leaves your process: it only signs the x402 payment
// (and the optional registration/trial signatures) locally. No wallet is ever
// created or held server-side.

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = process.env.MINIA2A_BASE || "https://minia2a.uk";

function normalizeKey(key) {
  return key.startsWith("0x") ? key : "0x" + key;
}

// Stable agent identity. Generated once and persisted, then sent as
// X-Agent-ID on every call. The gateway stores only HMAC-SHA256(secret, id),
// never the id itself, so this is a privacy-safe "distinct agents" signal
// rather than a tracking cookie. One id per machine, not per process — it
// must survive restarts or every run would count as a new agent.
let _agentId;
function agentId() {
  if (_agentId) return _agentId;
  if (process.env.MINIA2A_AGENT_ID) return (_agentId = process.env.MINIA2A_AGENT_ID);
  const file = join(homedir(), ".minia2a-agent-id");
  try {
    _agentId = readFileSync(file, "utf8").trim();
    if (_agentId) return _agentId;
  } catch {
    // no file yet — fall through and create one
  }
  _agentId = "agent:" + randomUUID();
  try {
    writeFileSync(file, _agentId);
  } catch {
    // read-only home: keep the in-memory id, still a valid distinct agent
  }
  return _agentId;
}

// Map a short name ("gas") to a full service id ("x402-gas"). Pass the full
// id through unchanged so callers can use either form.
function resolveServiceId(service) {
  return service.startsWith("x402-") ? service : "x402-" + service;
}

// Canonical URL slug — the "x402-" prefix is dropped for the request path.
// CDP Bazaar indexes https://minia2a.uk/x402/<slug> (no prefix); the full id
// ("x402-gas") is only used for signatures, never for the URL.
function slugOf(serviceId) {
  return serviceId.startsWith("x402-") ? serviceId.slice(5) : serviceId;
}

/**
 * Create a minia2a client backed by a wallet private key.
 *
 * @param {string} [privateKey] - Wallet private key (0x-prefixed or bare 64 hex
 *   chars). Falls back to process.env.MINIA2A_PRIVATE_KEY. This wallet pays
 *   per-call fees in USDC on Base; the key is only used to sign locally and is
 *   never sent to minia2a.
 */
export function createClient(privateKey) {
  if (!privateKey) {
    privateKey = process.env.MINIA2A_PRIVATE_KEY;
  }
  if (!privateKey) {
    throw new Error(
      "private key required — pass it to createClient(key) or set MINIA2A_PRIVATE_KEY. " +
        "This wallet pays per-call fees in USDC on Base. No keys are ever sent to minia2a."
    );
  }
  const account = privateKeyToAccount(normalizeKey(privateKey));

  // x402 payment: exact-permit2 USDC settlement on Base. spendControls:false —
  // minia2a endpoints range from $0.001 to $200, above the default $1 cap.
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
    spendControls: false,
  });

  async function parseJson(res, text) {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  /**
   * Call a minia2a service. Sends POST /x402/<service-id> with a JSON body;
   * if the server answers 402 Payment Required, the x402 payment is completed
   * automatically (exact-permit2 USDC on Base) and the call retried.
   *
   * @param {string} service - Service name ("gas") or full id ("x402-gas").
   * @param {object} [params] - JSON body sent to the service.
   * @param {object} [opts] - {method, headers, body, timeout, trial}
   * @returns {Promise<object>} {ok:true, ...data} on success, {ok:false, ...} on failure.
   */
  async function call(service, params = {}, opts = {}) {
    const svcId = resolveServiceId(service);
    const slug = slugOf(svcId);
    const headers = {
      "Content-Type": "application/json",
      "X-Agent-ID": agentId(),
      ...opts.headers,
    };
    const timeout = opts.timeout || 60000;
    const body = opts.body !== undefined ? opts.body : JSON.stringify(params);

    let res;
    if (opts.trial) {
      // Free trial call. Trials are drawn from the wallet bucket the gateway names in
      // ?wallet=<address>, and the signature proves the caller owns that wallet:
      //   - signature without ?wallet=  → the bucket is never selected, plain 402
      //   - ?wallet= without a valid sig → same 402 as an anonymous call
      // Both halves are required. (Measured 2026-09-11: the signature-only form this
      // client shipped with returned 402 on every trial call, so the advertised
      // "5 free trial calls" path never actually ran.)
      const ts = Math.floor(Date.now() / 1000);
      const sig = await account.signMessage({
        message: `minia2a trial:${account.address}:${svcId}:${ts}`,
      });
      headers["X-Wallet-Signature"] = sig;
      headers["X-Trial-Timestamp"] = String(ts);
      res = await globalThis.fetch(
        `${BASE}/x402/${slug}?wallet=${account.address}`,
        {
          method: opts.method || "POST",
          headers,
          body,
          signal: AbortSignal.timeout(timeout),
        }
      );
    } else {
      res = await fetchWithPayment(`${BASE}/x402/${slug}`, {
        method: opts.method || "POST",
        headers,
        body,
        signal: AbortSignal.timeout(timeout),
      });
    }

    const text = await res.text();
    const data = await parseJson(res, text);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error || data.message || "call failed",
        ...(data.accepts || res.status === 402
          ? { paymentRequired: data, helpUrl: `${BASE}/x402-help.html` }
          : {}),
      };
    }
    return { ok: true, status: res.status, ...data };
  }

  /**
   * Optional registration — publishes your wallet's identity, not a trial key.
   * Trials are per-wallet and need no registration (see call(..., {trial:true})).
   * Not required to use the client: every call settles via x402 whether or not
   * you register. Most services have no trial allowance, so don't treat this as
   * the normal path.
   *
   * Signs "minia2a register: <wallet>" (EIP-191) and POSTs it with your name.
   *
   * @param {string} name - Agent/human name to associate with the wallet.
   * @returns {Promise<object>} {ok:true, wallet, message, trialHint, ...}
   */
  async function register(name) {
    const signature = await account.signMessage({
      message: `minia2a register: ${account.address}`,
    });
    const res = await globalThis.fetch(`${BASE}/api/v1/register-simple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "minia2a-client", wallet: account.address, signature }),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const data = await parseJson(res, text);
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error || data.message || "registration failed" };
    }
    return { ok: true, status: res.status, ...data };
  }

  /**
   * List the service catalog (free, not pay-gated).
   * @returns {Promise<object>} {ok:true, services:Array, count:number}
   */
  async function listServices() {
    const res = await globalThis.fetch(`${BASE}/api/services`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const data = await parseJson(res, text);
    if (!res.ok) return { ok: false, status: res.status, error: data.error || "list failed" };
    const services = Array.isArray(data) ? data : data.services || [];
    return { ok: true, status: res.status, count: data.count || services.length, services };
  }

  /**
   * Platform stats (free). Services, agents, volume, trial usage.
   * @returns {Promise<object>} {ok:true, ...stats}
   */
  async function status() {
    const res = await globalThis.fetch(`${BASE}/api/stats`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const data = await parseJson(res, text);
    if (!res.ok) return { ok: false, status: res.status, error: data.error || "status failed" };
    return { ok: true, status: res.status, ...data };
  }

  return {
    address: account.address,
    call,
    register,
    listServices,
    status,
  };
}
