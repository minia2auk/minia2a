import { makeCall } from "../src/nano.js";
import { agentId } from "../src/index.js";

let capturedHeaders = null;
const fetchWithPayment = async (_url, opts) => {
  capturedHeaders = opts.headers;
  return new Response("{}", { status: 200 });
};
const call = makeCall(fetchWithPayment);
await call("gas", {});
if (!capturedHeaders["X-Agent-ID"]) {
  console.error("FAIL: no X-Agent-ID header on nano call");
  process.exit(1);
}
if (capturedHeaders["X-Agent-ID"] !== agentId()) {
  console.error("FAIL: X-Agent-ID != base agentId()");
  process.exit(1);
}
console.log("PASS nano path sends X-Agent-ID = base agentId() =", capturedHeaders["X-Agent-ID"]);
