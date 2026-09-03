// minia2a-client — call 1,680+ AI agent tools via x402 micropayments on Base.
// Pay per call in USDC. No API keys, no subscription. Bring your own wallet.
//
//   import { createClient } from "minia2a-client";
//   const client = createClient(process.env.MINIA2A_PRIVATE_KEY);
//   const res = await client.call("gas");            // POST /x402/x402-gas, auto-pays 402
//   await client.register("my-agent");               // optional — unlocks 5 free trial calls
//
// The private key never leaves your process: it only signs the x402 payment
// (and the optional registration/trial signatures) locally. No wallet is ever
// created or held server-side.

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.MINIA2A_BASE || "https://minia2a.uk";

function normalizeKey(key) {
  return key.startsWith("0x") ? key : "0x" + key;
}

// Map a short name ("gas") to a full service id ("x402-gas"). Pass the full
// id through unchanged so callers can use either form.
function resolveServiceId(service) {
  return service.startsWith("x402-") ? service : "x402-" + service;
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
    const headers = { "Content-Type": "application/json", ...opts.headers };
    const timeout = opts.timeout || 60000;
    const body = opts.body !== undefined ? opts.body : JSON.stringify(params);

    let res;
    if (opts.trial) {
      // Free trial call — requires registration first (see register()).
      const ts = Math.floor(Date.now() / 1000);
      const sig = await account.signMessage({
        message: `minia2a trial:${account.address}:${svcId}:${ts}`,
      });
      headers["X-Wallet-Signature"] = sig;
      headers["X-Trial-Timestamp"] = String(ts);
      res = await globalThis.fetch(`${BASE}/x402/${svcId}`, {
        method: opts.method || "POST",
        headers,
        body,
        signal: AbortSignal.timeout(timeout),
      });
    } else {
      res = await fetchWithPayment(`${BASE}/x402/${svcId}`, {
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
   * Optional registration — unlocks 5 free trial calls for this wallet.
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
