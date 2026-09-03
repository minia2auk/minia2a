#!/usr/bin/env node
// minia2a-client demo — the V5 flow: catalog, optional registration, and a
// pay-per-call service (the paid call needs MINIA2A_PRIVATE_KEY).

import { createClient } from "./src/index.js";

const BASE = process.env.MINIA2A_BASE || "https://minia2a.uk";

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   minia2a-client — 1,680+ x402 tools       ║");
  console.log("║   pay per call in USDC on Base             ║");
  console.log("╚════════════════════════════════════════════╝\n");

  console.log("[1/4] Service catalog...");
  const svcRes = await fetch(`${BASE}/api/services`);
  const svcData = await svcRes.json();
  const services = Array.isArray(svcData) ? svcData : svcData.services || [];
  console.log(`  ${services.length} services available\n`);

  const key = process.env.MINIA2A_PRIVATE_KEY;
  if (!key) {
    console.log("[2/4] Registration — optional. Set MINIA2A_PRIVATE_KEY and run:");
    console.log("  export MINIA2A_PRIVATE_KEY=0x...   # your wallet, never sent anywhere\n");
    console.log("[3/4] Paid call — skipped (no key)\n");
  } else {
    const client = createClient(key);
    console.log("  Wallet: " + client.address);

    console.log("[2/4] Registering wallet (optional — unlocks 5 free trial calls)...");
    const reg = await client.register("demo");
    console.log("  " + (reg.ok ? reg.message : "register failed: " + reg.error) + "\n");

    console.log("[3/4] Paid call to x402-dns ($0.001)...");
    const dns = await client.call("dns", { domain: "minia2a.uk" });
    if (dns.ok) {
      console.log("  ok — paid and delivered:\n  " + JSON.stringify(dns).slice(0, 220));
    } else {
      console.log("  failed: " + (dns.error || dns.status));
    }
    console.log("");
  }

  console.log("[4/4] Platform status...");
  const statsRes = await fetch(`${BASE}/api/stats`);
  const stats = await statsRes.json();
  console.log(
    "  Services: " + stats.services + ", Agents: " + stats.agents + ", Volume: $" + (stats.totalVolumeCents / 100).toFixed(2)
  );

  console.log("\nDone. Try: minia2a list | MINIA2A_PRIVATE_KEY=0x... minia2a gas");
}

main().catch((e) => {
  console.error("Demo failed:", e.message);
});
