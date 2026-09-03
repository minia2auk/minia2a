// minia2a-audit — smart-contract audit for AI agents via x402.
// Calls minia2a.uk audit services, paying per call in USDC on Base (x402).
//   auditStatic(source)  → $2  static scan  (x402-smart-contract-audit)
//   auditAI(source)      → $20 AI deep audit (x402-ai-audit)
// No API keys, no subscription. Bring your own wallet private key.
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.MINIA2A_BASE || "https://minia2a.uk";

const SERVICES = {
  static: { id: "x402-smart-contract-audit", priceUsd: 2 },
  ai: { id: "x402-ai-audit", priceUsd: 20 },
};

function normalizeKey(key) {
  return key.startsWith("0x") ? key : "0x" + key;
}

export function createAuditClient(privateKey) {
  if (!privateKey) {
    privateKey = process.env.MINIA2A_PRIVATE_KEY;
  }
  if (!privateKey) {
    throw new Error(
      "private key required — pass it to createAuditClient(key) or set MINIA2A_PRIVATE_KEY. " +
        "This wallet pays the $2/$20 audit fee in USDC on Base. No keys are ever sent to minia2a."
    );
  }
  const account = privateKeyToAccount(normalizeKey(privateKey));
  // spendControls:false — audit services cost $2/$20, above the SDK's default $1/call cap.
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
    spendControls: false,
  });

  async function callService(which, body) {
    const svc = SERVICES[which];
    const res = await fetchWithPayment(`${BASE}/x402/${svc.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000), // AI audit can take a while
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
        ...(data.accepts ? { paymentRequired: data } : {}),
      };
    }
    // The service returns { ok, result: { findings, upgrade, risk, ... } }.
    // Flatten so callers get r.findings / r.upgrade / r.risk directly.
    const result = data.result || data;
    return { ok: true, ...result };
  }

  return {
    /**
     * $2 static scan — deterministic pattern check.
     * @param {string} source solidity source code
     * @param {{language?: string}} [opts] language: solidity|rust|move
     */
    async auditStatic(source, opts = {}) {
      return callService("static", { source }); // static scan is solidity-only
    },
    /**
     * $20 AI deep audit — 3x sampled, deduplicated, multi-chain.
     * Catches business-logic/economic/cross-contract flaws static can't.
     * @param {string} source
     * @param {{language?: string}} [opts]
     */
    async auditAI(source, opts = {}) {
      return callService("ai", {
        source,
        language: opts.language || "solidity",
      });
    },
  };
}
