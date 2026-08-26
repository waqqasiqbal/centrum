import { describe, expect, it } from "vitest";
import {
  AIInterfaceRuntime,
  ReadOnlyPolicy,
  type AgentProvider,
  type Capability,
} from "../packages/core/src/index.js";
import { createApp } from "../apps/server/src/app.js";

const principal = {
  id: "key_security_test",
  tenantId: "tenant_security_test",
  tenantName: "Security Test",
  capabilities: ["search_products", "deliver_json", "render_product_pdf", "deliver"],
};

describe("security boundaries", () => {
  it("requires an API key before executing a request", async () => {
    const { app } = await createApp({
      databasePath: ":memory:",
      provider: neverProvider,
      cursorSecret: "security-test-cursor-secret-32-bytes",
      logger: false,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      payload: { instruction: "List products as JSON" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      status: "failed",
      error: { code: "AUTHENTICATION_FAILED" },
    });
    await app.close();
  });

  it("rejects malformed requests before calling the provider", async () => {
    const { app, demoKeys } = await createApp({
      databasePath: ":memory:",
      provider: neverProvider,
      cursorSecret: "security-test-cursor-secret-32-bytes",
      logger: false,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/execute",
      headers: { "x-ai-interface-key": demoKeys[0].apiKey },
      payload: { instruction: "List products", unexpected: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      status: "failed",
      error: { code: "INVALID_REQUEST" },
    });
    await app.close();
  });

  it("does not expose development keys unless explicitly enabled", async () => {
    const { app } = await createApp({
      databasePath: ":memory:",
      provider: neverProvider,
      cursorSecret: "security-test-cursor-secret-32-bytes",
      logger: false,
      exposeDemoKeys: false,
    });
    const response = await app.inject({ method: "GET", url: "/v1/demo/keys" });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("sets defensive response headers", async () => {
    const { app } = await createApp({
      databasePath: ":memory:",
      provider: neverProvider,
      cursorSecret: "security-test-cursor-secret-32-bytes",
      logger: false,
      exposeDemoKeys: false,
    });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  it("rejects a provider that skips the governed capability sequence", async () => {
    const maliciousProvider: AgentProvider = {
      name: "malicious-test-provider",
      async run() {
        return {
          continuationToken: "response_1",
          model: "test",
          toolCalls: [{ id: "call_1", name: "deliver", arguments: { handleId: "forged" } }],
        };
      },
    };
    const passthroughSchema = {
      safeParse: (value: unknown) => ({ success: true as const, data: value }),
    } as Capability["inputSchema"];
    const capabilities = ["search_products", "deliver_json", "render_product_pdf", "deliver"].map(
      (name): Capability => ({
        name,
        description: name,
        inputSchema: passthroughSchema,
        parameters: { type: "object", properties: {}, additionalProperties: false },
        async execute() {
          return {};
        },
      }),
    );
    const runtime = new AIInterfaceRuntime({
      provider: maliciousProvider,
      capabilities,
      policy: new ReadOnlyPolicy(),
    });

    await expect(
      runtime.execute({ instruction: "List products as JSON" }, principal),
    ).rejects.toMatchObject({ code: "POLICY_DENIED" });
  });
});

const neverProvider: AgentProvider = {
  name: "never-provider",
  async run() {
    throw new Error("The provider should not be called in this test.");
  },
};
