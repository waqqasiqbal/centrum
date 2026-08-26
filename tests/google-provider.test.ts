import { describe, expect, it } from "vitest";
import { GoogleGeminiProvider } from "../packages/google/src/index.js";

describe("Google Gemini provider", () => {
  it("serializes tool results as Interactions API function results", async () => {
    const calls: Array<{ input: unknown }> = [];
    const client = {
      interactions: {
        create: async (request: { input: unknown }) => {
          calls.push(request);
          return {
            id: "interaction_1",
            steps: [
              {
                type: "function_call",
                id: "call_1",
                name: "deliver",
                arguments: { handleId: "delivery_1" },
              },
            ],
          };
        },
      },
    } as never;

    const provider = new GoogleGeminiProvider({ apiKey: "test", client });
    await provider.run({
      instruction: "Return products as JSON.",
      tools: [],
      continuationToken: "interaction_0",
      toolResults: [
        { callId: "call_search", name: "search_products", output: { handleId: "products_1" } },
      ],
      safetyIdentifier: "test",
      signal: new AbortController().signal,
    });

    expect(calls[0]?.input).toEqual([
      {
        type: "function_result",
        name: "search_products",
        call_id: "call_search",
        is_error: undefined,
        result: JSON.stringify({ handleId: "products_1" }),
      },
    ]);
  });
});
