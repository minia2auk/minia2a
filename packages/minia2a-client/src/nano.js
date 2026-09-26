// minia2a-client — Nano (XNO) settlement rail.
// Pay per call in feeless Nano on nano:mainnet, alongside the USDC-on-Base
// default. Settles via the x402 "exact" Nano scheme.
//
//   import { createNanoClient } from "minia2a-client/nano";
//   const client = await createNanoClient({ privateKey, rpcUrl });
//   const res = await client.call("gas");   // auto-pays a 402 in Nano
//
// The Nano private key never leaves your process: it only signs the Nano send
// block that is the x402 payment payload, locally. No wallet is ever created
// or held server-side.
//
// Scope (from the maintainer's guidance on this rail): this covers pays for
// paid calls and the acceptance seam — a Nano `accepts[]` entry — not the
// signed-trial flow, whose identifier is EVM-shaped (EIP-55) and is a
// separate, larger decision. An agent that holds only a Nano account cannot
// sign the EVM trial message; this rail is additive for agents that settle in
// Nano.

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
// Reuse the shared, persisted agent identity from the base client so both
// rails identify the same machine as one agent (never two).
import { agentId } from "./index.js";

// The Nano rail's dependencies (@x402nano/exact, @x402nano/helper) ship as
// *optional* dependencies and are imported lazily. `npm i minia2a-client`
// still installs them (optional deps are installed by default), so the default
// install graph is NOT smaller; what the lazy import buys is that a USDC-only
// user never *loads* the Nano SDK graph at runtime, and a missing optional dep
// degrades to a clear named error below instead of an install-time abort.
// They load only when createNanoClient() actually needs them.
async function loadNanoDep(specifier, what) {
  try {
    return await import(specifier);
  } catch (err) {
    throw new Error(
      `Nano rail unavailable: ${what} (${specifier}) is not installed. ` +
        `Install it with \`npm i ${specifier}\` to use minia2a-client/nano.`,
      { cause: err }
    );
  }
}

async function nanoHelperCtor() {
  return (await loadNanoDep("@x402nano/helper", "the Nano x402 helper")).Helper;
}

const BASE = process.env.MINIA2A_BASE || "https://minia2a.uk";

// ---------------------------------------------------------------------------
// Conformance rule (network family == payTo family == asset family), before
// any settlement code. An accept with network "nano:mainnet" but an EVM-length
// payTo is silently unpickable: it would be discovered, selected, then break
// at settlement — the most expensive place to find out. The rejection lands
// here, inside createPaymentPayload, before a send block is built (selection
// in @x402/fetch matches on `network` alone, so the family check can't happen
// there). Same family again for asset: XNO for nano:mainnet.
//
// Address decision: accept both canonical `nano_` and legacy `xrb_` prefixes
// (xrb_ addresses are still valid and spendable on the network), each
// lower-cased only — the `/i` flag is intentionally not used, so non-canonical
// NANO_/XRB_ casing is rejected.
// ---------------------------------------------------------------------------
const NANO_ADDR_RE = /^(?:nano|xrb)_[13456789abcdefghijkmnopqrstuwxyz]{60}$/;

function isNanoAsset(asset) {
  return /^XNO$/i.test(String(asset ?? ""));
}

export { ConformingExactNanoScheme, NANO_ADDR_RE, isNanoAsset, makeCall };

/**
 * A scheme wrapper that refuses to sign a Nano accept whose `payTo` or
 * `asset` disagrees with the `nano:mainnet` network family, before the send
 * block is created. Mirrors the `SchemeNetworkClient` interface of the EVM
 * scheme so both can sit in the same `schemes` array.
 */
class ConformingExactNanoScheme {
  static async build(helper) {
    const ExactNanoScheme = (
      await loadNanoDep("@x402nano/exact", "the Nano x402 exact scheme")
    ).ExactNanoScheme;
    const s = new ConformingExactNanoScheme();
    s._scheme = new ExactNanoScheme(helper);
    return s;
  }
  get scheme() {
    return this._scheme.scheme;
  }
  async createPaymentPayload(x402Version, paymentRequirements) {
    const { network, payTo, asset, amount } = paymentRequirements;
    if (network !== "nano:mainnet") {
      throw new Error(
        `conformance: ExactNanoScheme registered for nano:mainnet, got network "${network}"`
      );
    }
    if (!NANO_ADDR_RE.test(String(payTo ?? ""))) {
      throw new Error(
        `conformance: nano:mainnet payTo must be a nano_ or xrb_ address (got "${payTo}")`
      );
    }
    if (!isNanoAsset(asset)) {
      throw new Error(
        `conformance: nano:mainnet asset must be XNO (got "${asset}")`
      );
    }
    if (!(amount && String(amount).length > 0)) {
      throw new Error("conformance: nano:mainnet amount is required");
    }
    return this._scheme.createPaymentPayload(x402Version, paymentRequirements);
  }
}

function normalizeKey(key) {
  return key.startsWith("0x") ? key : "0x" + key;
}

function resolveServiceId(service) {
  return service.startsWith("x402-") ? service : "x402-" + service;
}

function makeCall(fetchWithPayment) {
  async function call(service, params = {}, opts = {}) {
    const svcId = resolveServiceId(service);
    // Identifies this agent exactly the way the USDC rail's makeCall does:
    // X-Agent-ID from the shared, persisted agentId(), read from the same
    // base (reused via export from ./index.js), so the nano path is not a
    // second, anonymous agent on the same machine.
    const headers = {
      "Content-Type": "application/json",
      "X-Agent-ID": agentId(),
      ...opts.headers,
    };
    const timeout = opts.timeout || 60000;
    const body = opts.body !== undefined ? opts.body : JSON.stringify(params);

    if (opts.trial) {
      // Refuse by name instead of falling through to a paid call: the trial
      // identifier is EVM-shaped (EIP-55) and a Nano-only holder cannot sign
      // it, so silently charging the first "trial" call would be the wrong
      // direction to degrade in.
      throw new Error(
        "trial is not supported on the nano rail — the trial identifier is " +
          "EVM-signed (minia2a trial:{wallet}:...); use createClient(privateKey) " +
          "or pass evmPrivateKey to carry the USDC rail"
      );
    }

    const res = await fetchWithPayment(`${BASE}/x402/${svcId}`, {
      method: opts.method || "POST",
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error || data.message || "call failed",
        ...(res.status === 402
          ? { paymentRequired: data, helpUrl: `${BASE}/x402-help.html` }
          : {}),
      };
    }
    return { ok: true, status: res.status, ...data };
  }
  return call;
}

/**
 * Create a minia2a client that settles in feeless Nano (XNO) on nano:mainnet.
 *
 * The client offers both rails: USDC on Base (the existing `ExactEvmScheme`)
 * and Nano on nano:mainnet (the additive `ExactNanoScheme`). Which rail a call
 * uses is decided by the 402 challenge the gateway returns — only an `accepts[]`
 * entry that is present is payable (per the maintainer's guidance), so a Nano
 * rail only engages when the server offers a `nano:mainnet` accept.
 *
 * @param {object} opts
 * @param {string} opts.privateKey - Nano account private key (64 hex chars).
 *   This wallet pays per-call fees in Nano; the key is only used to sign
 *   locally and is never sent to minia2a.
 * @param {string} [opts.rpcUrl] - Nano RPC URL used to build (and where the
 *   sender requires it) announce the send block. Defaults to a public Nano RPC.
 * @param {string} [opts.workGenerationUrl] - Nano work generation URL.
 * @param {string} [opts.evmPrivateKey] - Optional EVM private key if you also
 *   want the USDC-on-Base rail available from the same client.
 */
export async function createNanoClient({
  privateKey,
  rpcUrl,
  workGenerationUrl,
  evmPrivateKey,
} = {}) {
  if (!privateKey) {
    privateKey = process.env.MINIA2A_NANO_PRIVATE_KEY;
  }
  if (!privateKey) {
    throw new Error(
      "Nano private key required — pass privateKey or set MINIA2A_NANO_PRIVATE_KEY. " +
        "This wallet pays per-call fees in Nano (XNO); the key is used only to sign the send block locally."
    );
  }

  const Helper = await nanoHelperCtor();
  const helper = new Helper({
    NANO_ACCOUNT_PRIVATE_KEY: privateKey,
    NANO_RPC_URL: rpcUrl || process.env.MINIA2A_NANO_RPC_URL,
    NANO_WORK_GENERATION_URL: workGenerationUrl,
  });

  const schemes = [
    { network: "nano:mainnet", client: await ConformingExactNanoScheme.build(helper) },
  ];
  if (evmPrivateKey || process.env.MINIA2A_PRIVATE_KEY) {
    const evmKey = evmPrivateKey || process.env.MINIA2A_PRIVATE_KEY;
    const account = privateKeyToAccount(normalizeKey(evmKey));
    schemes.push({
      network: "eip155:8453",
      client: new ExactEvmScheme(account),
    });
  }

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
    schemes,
    spendControls: false,
  });

  return {
    scheme: "exact",
    network: "nano:mainnet",
    asset: "XNO",
    call: makeCall(fetchWithPayment),
  };
}
