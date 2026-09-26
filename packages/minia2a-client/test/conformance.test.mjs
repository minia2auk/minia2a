// Conformance tests for the Nano x402 scheme guard.
// Verifies maintainer's point 2 (network family == payTo family == asset family)
// is enforced BEFORE any settlement code runs, and point 4 (nano_/xrb_ accept,
// non-canonical casing rejected). Also verifies the trial refusal in makeCall().
import { ConformingExactNanoScheme, makeCall } from "../src/nano.js";
import assert from "node:assert";

const NANO_PAYTO = "nano_1xug1q5t7nxoj3ywwzokiea9jz8fq8qfgzp8pbyfr3co3e5xgj755uofu8ue";
const EVM_PAYTO = "0xAb62452b4b019bC4402BFfCca6C706d16d72A7Bf";

// Fake Helper exposing the same generateSendBlock surface the real one has.
// It never touches a network: it records the accepted requirements so we can
// assert the guard let the right accept through and rejected the wrong ones.
let lastGen = null;
const fakeHelper = {
  async generateSendBlock(req) {
    lastGen = req;
    return { hash: "FAKE".padEnd(64, "0"), signature: "sig", block: {} };
  },
  onBeforeWorkGeneration() { return this; },
  onAfterWorkGeneration() { return this; },
};

const scheme = await ConformingExactNanoScheme.build(fakeHelper);
const req = (over) => ({ x402Version: 2, scheme: "exact", network: "nano:mainnet", asset: "XNO", amount: "1000000000000000000000000", payTo: NANO_PAYTO, maxTimeoutSeconds: 60, extra: {}, ...over });

// (a) Valid Nano accept -> signed, generateSendBlock reached with the right payTo/amount.
{
  const out = await scheme.createPaymentPayload(2, req({}));
  assert.ok(out.x402Version === 2, "x402Version preserved");
  assert.ok(lastGen.payTo === NANO_PAYTO, "generateSendBlock got the nano payTo");
  assert.ok(out.payload && out.payload.block, "payload carries the Nano send block");
  console.log("PASS valid nano:mainnet accept -> send block generated");
}

// (b) Wrong family: nano:mainnet + EVM-length payTo -> rejected before signing.
{
  let threw = false;
  try {
    await scheme.createPaymentPayload(2, req({ payTo: EVM_PAYTO }));
  } catch (e) {
    threw = true;
    assert.match(e.message, /must be a nano_ address|must be a nano_ or xrb_ address/);
  }
  assert.ok(threw, "EVM payTo under nano:mainnet must be rejected");
  console.log("PASS wrong-family payTo rejected inside payload creation (point 2)");
}

// (b2) Legacy xrb_ prefix is still valid on the network -> accepted (point 4).
{
  const XRB_PAYTO = "xrb_1xug1q5t7nxoj3ywwzokiea9jz8fq8qfgzp8pbyfr3co3e5xgj755uofu8ue";
  const out = await scheme.createPaymentPayload(2, req({ payTo: XRB_PAYTO }));
  assert.ok(out.payload && out.payload.block, "xrb_ payTo accepted");
  console.log("PASS legacy xrb_ payTo accepted (point 4)");
}

// (b3) Non-canonical uppercase NANO_/XRB_ casing is rejected (point 4).
{
  let threw = false;
  try {
    await scheme.createPaymentPayload(2, req({ payTo: NANO_PAYTO.toUpperCase() }));
  } catch (e) {
    threw = true;
    assert.match(e.message, /must be a nano_ or xrb_ address/);
  }
  assert.ok(threw, "uppercase NANO_ payTo must be rejected");
  console.log("PASS non-canonical uppercase NANO_ rejected (point 4)");
}

// (c) Wrong asset: nano:mainnet + USDC -> rejected.
{
  let threw = false;
  try {
    await scheme.createPaymentPayload(2, req({ asset: "USDC" }));
  } catch (e) {
    threw = true;
    assert.match(e.message, /asset must be XNO/);
  }
  assert.ok(threw, "non-XNO asset under nano:mainnet must be rejected");
  console.log("PASS wrong asset rejected (point 2)");
}

// (d) Wrong network: scheme is registered for nano:mainnet only.
{
  let threw = false;
  try {
    await scheme.createPaymentPayload(2, req({ network: "eip155:8453" }));
  } catch (e) {
    threw = true;
    assert.match(e.message, /registered for nano:mainnet/);
  }
  assert.ok(threw, "non-nano network must be rejected");
  console.log("PASS wrong network rejected (point 2)");
}

// (e) Missing amount -> rejected.
{
  let threw = false;
  try {
    await scheme.createPaymentPayload(2, req({ amount: "" }));
  } catch (e) {
    threw = true;
    assert.match(e.message, /amount is required/);
  }
  assert.ok(threw, "missing amount must be rejected");
  console.log("PASS missing amount rejected");
}

console.log("ALL nano-scheme conformance tests passed");

// Unit test for the trial refusal inside makeCall() (point 2 of the review):
// opts.trial must throw by name, never fall through to a paid call. makeCall
// is exported for tests; it returns the `call` function which we drive with a
// spy fetchWithPayment that would fail the test if ever reached.
{
  let fetchReached = false;
  const fetchWithPayment = async () => {
    fetchReached = true;
    return new Response("{}", { status: 200 });
  };
  const call = makeCall(fetchWithPayment);
  let threw = null;
  try {
    await call("gas", {}, { trial: true });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, "trial must throw on the nano rail");
  assert.match(threw.message, /trial is not supported on the nano rail/);
  assert.ok(!fetchReached, "no paid call must be attempted when trial is refused");
  console.log("PASS opts.trial refused by name, no fetch attempted (point 2)");
}
