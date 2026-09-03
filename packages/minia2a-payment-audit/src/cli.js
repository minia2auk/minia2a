#!/usr/bin/env node
// minia2a-payment-audit CLI — black-box x402 payment trust check, pay via x402.
//   minia2a-payment-audit check https://host/x402/time
// Requires MINIA2A_PRIVATE_KEY (wallet pays $5 USDC on Base).
import { createPaymentAuditClient } from "./index.js";

function usage() {
  console.error(`minia2a-payment-audit — x402 payment trust check via x402 (pay per call)

Usage:
  minia2a-payment-audit check <endpoint-url>      $5 black-box check before you pay an x402 seller

  Verdict: SAFE (rejects forged/replayed payment) | RISK (delivers without verifying) | NOT_X402

Env:
  MINIA2A_PRIVATE_KEY   wallet private key (pays USDC on Base)
  MINIA2A_BASE          default https://minia2a.uk
`);
}

async function main() {
  const [cmd, url] = process.argv.slice(2);
  if (cmd !== "check" || !url) {
    usage();
    process.exit(1);
  }
  console.error(`probing ${url} (x402 payment trust check, $5)…`);
  const client = createPaymentAuditClient();
  const result = await client.trustCheck(url);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
