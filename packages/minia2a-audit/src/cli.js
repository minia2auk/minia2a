#!/usr/bin/env node
// minia2a-audit CLI — audit a contract source file, pay per call via x402.
//   minia2a-audit static ./contract.sol
//   minia2a-audit ai ./contract.sol [--language rust]
// Requires MINIA2A_PRIVATE_KEY (wallet pays $2/$20 USDC on Base).
import { readFileSync } from "node:fs";
import { createAuditClient } from "./index.js";

function usage() {
  console.error(`minia2a-audit — smart-contract audit via x402 (pay per call)

Usage:
  minia2a-audit static <contract.sol>            $2 static scan (10 patterns)
  minia2a-audit ai <contract.sol|.rs|.move> [--language solidity|rust|move]   $20 AI deep audit

Env:
  MINIA2A_PRIVATE_KEY   wallet private key (pays USDC on Base)
  MINIA2A_BASE          default https://minia2a.uk
`);
}

async function main() {
  const [mode, file, ...rest] = process.argv.slice(2);
  if (!mode || !file || !["static", "ai"].includes(mode)) {
    usage();
    process.exit(1);
  }
  const langIdx = rest.indexOf("--language");
  const language = langIdx >= 0 ? rest[langIdx + 1] : "solidity";

  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
  console.error(`auditing ${file} (${source.length} bytes) via ${mode} audit…`);

  const client = createAuditClient();
  const result =
    mode === "static"
      ? await client.auditStatic(source)
      : await client.auditAI(source, { language });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
