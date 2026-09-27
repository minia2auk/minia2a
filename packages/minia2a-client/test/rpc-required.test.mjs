// Regression guards for the two failure points fixed on this branch.
//
// 1. createNanoClient() must reject a missing Nano RPC URL *up front*, by
//    option name. @x402nano/helper validates NANO_RPC_URL only inside
//    generateSendBlock -- i.e. after the 402, from within the payment path --
//    so without this check the documented minimal call fails at the worst
//    possible place, wrapped in the scheme's own error.
//
// 2. The opts.trial refusal must name only a remedy that works. The check is
//    unconditional at the top of makeCall(), and makeCall() is only ever handed
//    fetchWithPayment -- it has no EVM branch -- so "pass evmPrivateKey to
//    carry the USDC rail" was an instruction that could not be followed.
//
// Neither test touches the network: the trial check throws before any fetch,
// and both cases stop at construction.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createNanoClient } from "../src/nano.js";

const KEY = "0".repeat(64);
const savedRpc = process.env.MINIA2A_NANO_RPC_URL;
delete process.env.MINIA2A_NANO_RPC_URL;

after(() => {
  if (savedRpc !== undefined) process.env.MINIA2A_NANO_RPC_URL = savedRpc;
});

test("createNanoClient rejects a missing rpcUrl by name, before any request", async () => {
  await assert.rejects(
    () => createNanoClient({ privateKey: KEY }),
    (err) => {
      assert.match(err.message, /Nano RPC URL required/);
      assert.match(err.message, /MINIA2A_NANO_RPC_URL/);
      return true;
    }
  );
});

test("createNanoClient accepts an explicit rpcUrl", async () => {
  const client = await createNanoClient({ privateKey: KEY, rpcUrl: "http://127.0.0.1:1" });
  assert.equal(client.network, "nano:mainnet");
  assert.equal(client.asset, "XNO");
  assert.equal(typeof client.call, "function");
});

test("the trial refusal names only the remedy that works", async () => {
  const client = await createNanoClient({ privateKey: KEY, rpcUrl: "http://127.0.0.1:1" });
  await assert.rejects(
    () => client.call("gas", {}, { trial: true }),
    (err) => {
      assert.match(err.message, /trial is not supported on the nano rail/);
      assert.doesNotMatch(err.message, /pass evmPrivateKey/);
      return true;
    }
  );
});
