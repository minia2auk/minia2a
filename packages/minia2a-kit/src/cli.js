#!/usr/bin/env node
// minia2a-kit CLI — discovery/memory/knowledge for agents, pay per call via x402.
//   minia2a-kit find "captcha solve"
//   minia2a-kit recall "how does x402 settlement work"
//   minia2a-kit store "meeting notes: signed Base grant"
//   minia2a-kit search "latest AI agent news"
// Requires MINIA2A_PRIVATE_KEY (wallet pays per-call USDC on Base).
import { createClient } from "./index.js";

function usage() {
  console.error(`minia2a-kit — discovery, memory & knowledge for AI agents (x402)

Usage:
  minia2a-kit find "<task>"        find the right service ($0.50)
  minia2a-kit recall "<question>"  agent-economy knowledge ($0.50)
  minia2a-kit store "<text>"       persist a memory, get an id ($0.50)
  minia2a-kit search "<query>"     web search ($0.01)

Env:
  MINIA2A_PRIVATE_KEY   wallet private key (pays USDC on Base)
  MINIA2A_BASE          default https://minia2a.uk
`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const query = rest.join(" ");
  if (!cmd || !query || !["find", "recall", "store", "search"].includes(cmd)) {
    usage();
    process.exit(1);
  }
  const client = createClient();
  let result;
  if (cmd === "find") result = await client.findService(query);
  else if (cmd === "recall") result = await client.recall(query);
  else if (cmd === "store") result = await client.store(query);
  else result = await client.webSearch(query);

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
