import readline from "node:readline";

const apiUrl = process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai";
const model = process.env.TYPESAFE_MODEL ?? "jev-latest";
const clip = (value, max) => value.trim().slice(0, max);

export function redact(value) {
  return value
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, "[REDACTED_KEY]")
    .replace(/(xox[baprs]-[A-Za-z0-9-]+)/g, "[REDACTED_TOKEN]")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*[^\s]+/g, "$1=[REDACTED]");
}

export function buildDecisionPacket(input) {
  return {
    question: clip(redact(input.question), 1200),
    options: input.options.map((option) => clip(redact(option), 200)).slice(0, 10),
    state: clip(redact(input.state), 12000),
    acceptanceCriteria: (input.acceptanceCriteria ?? []).map((item) => clip(redact(item), 500)).slice(0, 12),
    evidence: (input.evidence ?? []).slice(0, 12).map(({ name, status, detail }) => ({
      name: clip(redact(name), 120), status, ...(detail ? { detail: clip(redact(detail), 800) } : {}),
    })),
    risks: (input.risks ?? []).map((item) => clip(redact(item), 500)).slice(0, 8),
    unknowns: (input.unknowns ?? []).map((item) => clip(redact(item), 500)).slice(0, 8),
  };
}

async function judge(input) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error("TYPESAFE_API_KEY is not set");
  const packet = buildDecisionPacket(input);
  const response = await fetch(`${apiUrl}/v1/systemone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      state: packet,
      questions: {
        decision: {
          type: "choice",
          instructions: packet.question,
          criteria: Object.fromEntries(packet.options.map((option) => [option, null])),
        },
      },
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`TypeSafe API ${response.status}: ${JSON.stringify(body).slice(0, 1000)}`);
  return { packet, model: body.model, answer: body.answers?.decision, usage: body.usage };
}

const inputSchema = {
  type: "object",
  required: ["question", "state", "options"],
  properties: {
    question: { type: "string", minLength: 1, maxLength: 12000 },
    state: { type: "string", minLength: 1, maxLength: 50000 },
    options: { type: "array", minItems: 2, maxItems: 10, items: { type: "string", minLength: 1, maxLength: 500 } },
    acceptanceCriteria: { type: "array", maxItems: 20, items: { type: "string", maxLength: 1000 } },
    evidence: { type: "array", maxItems: 20 },
    risks: { type: "array", maxItems: 12, items: { type: "string", maxLength: 1000 } },
    unknowns: { type: "array", maxItems: 12, items: { type: "string", maxLength: 1000 } },
  },
};

function validateInput(input) {
  if (!input || typeof input !== "object") throw new Error("arguments must be an object");
  if (typeof input.question !== "string" || !input.question.trim()) throw new Error("question is required");
  if (typeof input.state !== "string" || !input.state.trim()) throw new Error("state is required");
  if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 10) throw new Error("options must contain 2 to 10 items");
}

function send(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
function reply(id, result) { send({ jsonrpc: "2.0", id, result }); }
function error(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }

async function handle(message) {
  if (message.method === "notifications/initialized") return;
  if (message.method === "initialize") {
    reply(message.id, { protocolVersion: message.params?.protocolVersion ?? "2024-11-05", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "gdg-dju-jev", version: "0.1.0" } });
    return;
  }
  if (message.method === "ping") { reply(message.id, {}); return; }
  if (message.method === "tools/list") {
    reply(message.id, [{ name: "jev_judge", description: "Call Jev only when a structured decision is needed. Sends a compact, redacted decision packet and returns a typed choice with probabilities.", inputSchema }]);
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "jev_judge") {
    try {
      validateInput(message.params.arguments);
      const result = await judge(message.params.arguments);
      reply(message.id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
    } catch (cause) {
      reply(message.id, { isError: true, content: [{ type: "text", text: cause instanceof Error ? cause.message : String(cause) }] });
    }
    return;
  }
  if (message.id !== undefined) error(message.id, -32601, `Unknown method: ${message.method}`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { await handle(JSON.parse(line)); } catch (cause) { error(null, -32700, cause instanceof Error ? cause.message : String(cause)); }
  }
}
