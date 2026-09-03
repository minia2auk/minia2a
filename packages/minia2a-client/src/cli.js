#!/usr/bin/env node
// minia2a CLI — call 1,680+ AI agent tools via x402 micropayments on Base.
// Pay per call in USDC. Requires a wallet private key for paid calls.

import { createClient } from "./index.js";

const BASE = process.env.MINIA2A_BASE || "https://minia2a.uk";

function help() {
  console.log(`minia2a — 1,680+ AI agent tools via x402 USDC on Base

Usage:
  minia2a <service> [json-params]   Call a service (pay per call, auto 402)
  minia2a call <service> [json]     Explicit call
  minia2a list                      Full service catalog (free)
  minia2a search <q>                Search services by keyword (free)
  minia2a stats                     Marketplace stats (free)
  minia2a register <name>           Optional — unlock 5 free trial calls
  minia2a help                      This help

Env:
  MINIA2A_PRIVATE_KEY=0x...         Wallet that pays per-call USDC (never sent anywhere)
  MINIA2A_BASE=https://minia2a.uk   Optional base URL override

Examples:
  MINIA2A_PRIVATE_KEY=0x... minia2a gas
  MINIA2A_PRIVATE_KEY=0x... minia2a dns '{"domain":"minia2a.uk"}'
  minia2a search captcha
  minia2a register my-agent
`);
}

function jsonOrRaw(arg) {
  if (!arg) return {};
  try {
    return JSON.parse(arg);
  } catch {
    return { q: arg };
  }
}

async function main() {
  const [cmd, arg] = [process.argv[2] || "help", process.argv[3]];

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    return;
  }

  // Free commands — no wallet needed.
  if (cmd === "list" || cmd === "discover") {
    const res = await fetch(`${BASE}/api/services`);
    const data = await res.json();
    const services = Array.isArray(data) ? data : data.services || [];
    console.log(`${services.length} services on minia2a:\n`);
    for (const s of services.slice(0, 25)) {
      const price = "$" + ((s.priceCents ?? s.price_cents ?? 0) / 100).toFixed(4);
      console.log(`  ${s.name || s.id} | ${price} | ${s.category || ""}`);
    }
    if (services.length > 25) console.log(`\n  ... and ${services.length - 25} more. Use: minia2a list`);
    return;
  }

  if (cmd === "search" || cmd === "find") {
    if (!arg) {
      console.log("Usage: minia2a search <keyword>");
      return;
    }
    const res = await fetch(`${BASE}/api/services`);
    const data = await res.json();
    const services = (Array.isArray(data) ? data : data.services || []).filter((s) =>
      `${s.name} ${s.id} ${s.description || ""} ${s.category}`.toLowerCase().includes(arg.toLowerCase())
    );
    console.log(`${services.length} services matching "${arg}":\n`);
    for (const s of services.slice(0, 20)) {
      const price = "$" + ((s.priceCents ?? s.price_cents ?? 0) / 100).toFixed(4);
      console.log(`  ${s.name || s.id} | ${price} | ${s.category || ""}`);
    }
    return;
  }

  if (cmd === "stats") {
    const res = await fetch(`${BASE}/api/stats`);
    const d = await res.json();
    console.log("minia2a.uk Marketplace Stats");
    console.log("============================");
    console.log("Services:  " + d.services);
    console.log("Agents:    " + d.agents);
    console.log("Volume:    $" + (d.totalVolumeCents / 100).toFixed(2));
    console.log("Txns:      " + d.totalTransactions);
    console.log("Trials:    " + d.trials.totalUsed);
    return;
  }

  // Paid / register commands — need a wallet.
  const key = process.env.MINIA2A_PRIVATE_KEY;
  const client = createClient(key); // throws if no key

  if (cmd === "register") {
    const r = await client.register(arg || "minia2a-client");
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  if (cmd === "call") {
    const svc = arg || "help";
    if (!arg) {
      help();
      return;
    }
    const r = await client.call(svc, jsonOrRaw(process.argv[4]));
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  // Default: treat the first arg as a service name.
  const r = await client.call(cmd, jsonOrRaw(arg));
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
