// minia2a-payment-audit — x402 payment trust check for AI agents via x402.
// Calls the minia2a.uk x402-payment-audit service ($5), paying in USDC on Base.
//   trustCheck(url) → SAFE / RISK / NOT_X402
// Black-box probe run on minia2a's side (probe logic is not open-sourced):
// does the x402 endpoint you plan to pay actually verify payment — reject a
// forged txHash / forged signature / replayed payment — before delivering?
// No API keys, no subscription. Bring your own wallet private key.
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.MINIA2A_BASE || "https://minia2a.uk";
const SERVICE = { id: "x402-payment-audit", priceUsd: 5 };

function normalizeKey(key) {
  return key.startsWith("0x") ? key : "0x" + key;
}

export function createPaymentAuditClient(privateKey) {
  if (!privateKey) {
    privateKey = process.env.MINIA2A_PRIVATE_KEY;
  }
  if (!privateKey) {
    throw new Error(
      "private key required — pass it to createPaymentAuditClient(key) or set MINIA2A_PRIVATE_KEY. " +
        "This wallet pays the $5 check fee in USDC on Base. No keys are ever sent to minia2a."
    );
  }
  const account = privateKeyToAccount(normalizeKey(privateKey));
  // spendControls:false — the service costs $5, above the SDK's default $1/call cap.
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
    spendControls: false,
  });

  /**
   * $5 x402 payment trust check — black-box probe before you pay an x402 seller:
   * does the endpoint reject forged txHash / forged signature / replay before
   * delivering? Verdict is SAFE | RISK | NOT_X402 (not an x402 endpoint).
   * @param {string} url the x402 endpoint you plan to pay (https://host/x402/...)
   */
  async function trustCheck(url) {
    if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return { ok: false, error: "url required — the x402 endpoint you plan to pay (https://...)" };
    }
    const res = await fetchWithPayment(`${BASE}/x402/${SERVICE.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(90000), // black-box probe can take up to 70s
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
    const result = data.result || data;
    return { ok: true, ...result };
  }

  return { trustCheck };
}
