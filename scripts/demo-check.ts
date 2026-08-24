export {};

const url = process.env.DEMO_HEALTH_URL ?? `http://localhost:${process.env.PORT ?? "3000"}/health`;
const timeoutMs = Number(process.env.DEMO_HEALTH_TIMEOUT_MS ?? 5_000);
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, { signal: controller.signal });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  const parsed = JSON.parse(body) as { status?: string };
  if (parsed.status !== "ok") throw new Error("Health response did not report status=ok.");
  console.log(`Demo health check passed: ${url}`);
} finally {
  clearTimeout(timer);
}

