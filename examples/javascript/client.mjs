const baseUrl = (process.env.CENTRUM_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const apiKey = process.env.CENTRUM_API_KEY;
if (!apiKey) throw new Error("Set CENTRUM_API_KEY first");

async function request(method, path, body, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "x-ai-interface-key": apiKey,
      ...(body ? { "content-type": "application/json" } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(result)}`);
  return result;
}

console.log(await request("POST", "/v1/execute", {
  instruction: "Return my in-stock products under 100 EUR as JSON",
}));

const slug = "javascript-featured-products";
await request("POST", "/v1/persisted-apis", {
  slug,
  instruction: "Return my first three products as JSON",
}, { "idempotency-key": `${slug}-v1` });

console.log("persisted response without another LLM call:");
console.log(await request("GET", `/v1/persisted/${slug}`));
