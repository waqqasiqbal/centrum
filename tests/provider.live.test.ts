import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AgentProvider } from "../packages/core/src/index.js";
import { GoogleGeminiProvider } from "../packages/google/src/index.js";
import { OpenAIResponsesProvider } from "../packages/openai/src/index.js";
import { createApp } from "../apps/server/src/app.js";

let created: Awaited<ReturnType<typeof createApp>>;
let temporaryDirectory: string;

describe("configured live LLM evaluation", () => {
  beforeAll(async () => {
    const provider = configuredProvider();
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-interfaces-live-"));
    created = await createApp({
      databasePath: ":memory:",
      artifactDirectory: path.join(temporaryDirectory, "artifacts"),
      logger: false,
      provider,
    });
  });

  afterAll(async () => {
    await created.app.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("interprets a representative governed JSON request", async () => {
    const key = created.demoKeys[0].apiKey;
    const response = await created.app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { "x-ai-interface-key": key },
      payload: {
        instruction:
          "Return my in-stock products over €20, sorted by price descending, 5 per page.",
        options: { includeTrace: true },
      },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      status: "completed",
      output: { kind: "data", mediaType: "application/json" },
      trace: { provider: created.provider.name },
    });
  }, 45_000);
});

function configuredProvider(): AgentProvider {
  const selected = process.env.AI_PROVIDER ?? "openai";
  if (selected === "google") {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required.");
    return new GoogleGeminiProvider({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GOOGLE_MODEL ?? "gemini-3.5-flash-lite",
    });
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");
  return new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
  });
}
