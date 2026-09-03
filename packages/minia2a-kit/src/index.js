// minia2a-kit — memory, discovery and knowledge for AI agents via x402.
// Calls minia2a.uk services, paying per call in USDC on Base (x402).
//   findService(query)  → semantic search over the 1,600+ service catalog
//   recall(query)       → agent-economy knowledge-base answers
//   store(content)      → persist a fact/memory, returns an id
//   webSearch(query)    → web search with structured results
// No API keys, no subscription. Bring your own wallet private key.
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.MINIA2A_BASE || "https://minia2a.uk";

const SERVICES = {
  find: { id: "x402-find", priceUsd: 0.5 },
  recall: { id: "x402-recall", priceUsd: 0.5 },
  store: { id: "x402-store", priceUsd: 0.5 },
  webSearch: { id: "x402-search", priceUsd: 0.01 },
};

function normalizeKey(key) {
  return key.startsWith("0x") ? key : "0x" + key;
}

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
      signal: AbortSignal.timeout(60000),
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
    // Flat: expose results/stored at top level.
    return { ok: true, ...data };
  }

  return {
    /**
     * Find the right service for a task — semantic search over the catalog.
     * @param {string} query e.g. "captcha solve", "token price"
     * @param {{limit?: number}} [opts]
     * @returns {Promise<{ok:true, count:number, results:Array}>}
     */
    async findService(query, opts = {}) {
      return callService("find", { q: query, limit: opts.limit || 5 });
    },
    /**
     * Ask the agent-economy knowledge base.
     * @param {string} query e.g. "how does x402 settlement work"
     */
    async recall(query) {
      return callService("recall", { q: query });
    },
    /**
     * Persist a fact/memory across calls. Returns an id you can recall later.
     * @param {string} content
     * @returns {Promise<{ok:true, stored:boolean, id:string}>}
     */
    async store(content) {
      return callService("store", { content });
    },
    /**
     * Web search with structured results.
     * @param {string} query
     */
    async webSearch(query) {
      return callService("webSearch", { q: query });
    },
  };
}
