import assert from "node:assert/strict";
import { buildDecisionPacket } from "./index.mjs";

const packet = buildDecisionPacket({
  question: "PASS or RETRY?",
  state: "API_KEY=secret-value\n변경 요약",
  options: ["PASS", "RETRY"],
  evidence: [{ name: "test", status: "PASS", detail: "42 passed" }],
});

assert.equal(packet.options.length, 2);
assert.equal(packet.state.includes("secret-value"), false);
assert.equal(packet.state.includes("[REDACTED]"), true);
assert.equal(packet.evidence[0].status, "PASS");
console.log("jev-mcp self-test passed");
