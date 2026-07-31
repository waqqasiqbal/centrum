import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OpenAIResponsesProvider } from "../packages/openai/src/index.js";
import { createApp } from "../apps/server/src/app.js";

let created: Awaited<ReturnType<typeof createApp>>;
let temporaryDirectory: string;

describe("OpenAI Responses API live evaluation", () => {
  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is required for the LLM end-to-end suite. Scripted providers are intentionally unsupported.",
      );
    }
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-interfaces-live-"));
    created = await createApp({
      databasePath: ":memory:",
      artifactDirectory: path.join(temporaryDirectory, "artifacts"),
      logger: false,
      provider: new OpenAIResponsesProvider({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
      }),
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
          "Return my in-stock products over €20, sorted by price descending, 5 per page, as JSON.",
        options: { includeTrace: true },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "completed",
      output: { kind: "data" },
      trace: { provider: "openai-responses" },
    });
  }, 45_000);
});
