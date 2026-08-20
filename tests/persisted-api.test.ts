import { describe, expect, it } from "vitest";
import type { AgentProvider, ToolResult } from "../packages/core/src/index.js";
import { createApp } from "../apps/server/src/app.js";

describe("persisted APIs", () => {
  it("builds once with the provider and serves subsequent requests deterministically", async () => {
    const provider = createJsonProvider();
    const { app, demoKeys, database } = await createApp({
      databasePath: ":memory:",
      provider,
      cursorSecret: "persisted-api-test-cursor-secret-32-bytes",
      logger: false,
    });
    const headers = {
      "x-ai-interface-key": demoKeys[0].apiKey,
      "idempotency-key": "build-featured-products-1",
    };

    const created = await app.inject({
      method: "POST",
      url: "/v1/persisted-apis",
      headers,
      payload: {
        slug: "featured-products",
        instruction: "Return the first two products as JSON",
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      status: "completed",
      api: {
        slug: "featured-products",
        version: 1,
        published: true,
        invokeUrl: "/v1/persisted/featured-products",
        responseBody: expect.any(Array),
      },
    });
    expect(provider.calls).toBe(3);

    const firstInvocation = await app.inject({
      method: "GET",
      url: "/v1/persisted/featured-products",
      headers: { "x-ai-interface-key": demoKeys[0].apiKey },
    });
    const firstProduct = database.db
      .prepare("SELECT id FROM products WHERE tenant_id = ? ORDER BY name, id LIMIT 1")
      .get("tenant_nordic") as { id: string };
    database.db
      .prepare("UPDATE products SET name = ? WHERE tenant_id = ? AND id = ?")
      .run("Aardvark after compilation", "tenant_nordic", firstProduct.id);
    const secondInvocation = await app.inject({
      method: "GET",
      url: "/v1/persisted/featured-products",
      headers: { "x-ai-interface-key": demoKeys[0].apiKey },
    });
    expect(firstInvocation.statusCode).toBe(200);
    expect(firstInvocation.json()[0].name).toBe("Aurora Headphones");
    expect(secondInvocation.json()[0].name).toBe("Aardvark after compilation");
    expect(secondInvocation.json()).not.toEqual(firstInvocation.json());
    expect(firstInvocation.headers["x-persisted-api-version"]).toBe("1");
    expect(provider.calls).toBe(3);

    const replay = await app.inject({
      method: "POST",
      url: "/v1/persisted-apis",
      headers,
      payload: {
        slug: "featured-products",
        instruction: "Return the first two products as JSON",
      },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(provider.calls).toBe(3);

    expect(
      database.db
        .prepare("SELECT COUNT(*) as count FROM persisted_api_audit")
        .get(),
    ).toMatchObject({ count: 1 });
    await app.close();
  });

  it("supports versioned manual updates and rejects stale writes", async () => {
    const provider = createJsonProvider();
    const { app, demoKeys, database } = await createApp({
      databasePath: ":memory:",
      provider,
      cursorSecret: "persisted-api-test-cursor-secret-32-bytes",
      logger: false,
    });
    const apiKey = demoKeys[0].apiKey;
    await app.inject({
      method: "POST",
      url: "/v1/persisted-apis",
      headers: {
        "x-ai-interface-key": apiKey,
        "idempotency-key": "build-editable-products-1",
      },
      payload: { slug: "editable-products", instruction: "Return products as JSON" },
    });

    const current = await app.inject({
      method: "GET",
      url: "/v1/persisted-apis/editable-products",
      headers: { "x-ai-interface-key": apiKey },
    });
    const currentPlan = current.json().api.plan;
    const updated = await app.inject({
      method: "PUT",
      url: "/v1/persisted-apis/editable-products",
      headers: { "x-ai-interface-key": apiKey },
      payload: {
        expectedVersion: 1,
        plan: {
          ...currentPlan,
          search: { ...currentPlan.search, limit: 3 },
        },
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      api: {
        version: 2,
        plan: { search: { limit: 3 } },
      },
    });
    expect(provider.calls).toBe(3);

    const stale = await app.inject({
      method: "PUT",
      url: "/v1/persisted-apis/editable-products",
      headers: { "x-ai-interface-key": apiKey },
      payload: { expectedVersion: 1, published: false },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: { code: "CONFLICT" } });
    expect(
      database.db
        .prepare("SELECT COUNT(*) as count FROM persisted_api_versions")
        .get(),
    ).toMatchObject({ count: 2 });
    await app.close();
  });

  it("keeps persisted routes tenant-scoped", async () => {
    const provider = createJsonProvider();
    const { app, demoKeys } = await createApp({
      databasePath: ":memory:",
      provider,
      cursorSecret: "persisted-api-test-cursor-secret-32-bytes",
      logger: false,
    });
    await app.inject({
      method: "POST",
      url: "/v1/persisted-apis",
      headers: {
        "x-ai-interface-key": demoKeys[0].apiKey,
        "idempotency-key": "build-private-products-1",
      },
      payload: { slug: "private-products", instruction: "Return products as JSON" },
    });

    const otherTenant = await app.inject({
      method: "GET",
      url: "/v1/persisted/private-products",
      headers: { "x-ai-interface-key": demoKeys[1].apiKey },
    });
    expect(otherTenant.statusCode).toBe(404);
    expect(otherTenant.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    await app.close();
  });
});

function createJsonProvider(): AgentProvider & { calls: number } {
  return {
    name: "persisted-api-test-provider",
    calls: 0,
    async run(input) {
      this.calls += 1;
      if (this.calls % 3 === 1) {
        return {
          responseId: `response_${this.calls}`,
          model: "test-model",
          toolCalls: [
            {
              id: `call_${this.calls}`,
              name: "search_products",
              arguments: {
                filters: [],
                sort: { field: "name", direction: "asc" },
                limit: 2,
                projection: ["id", "name"],
                cursor: null,
              },
            },
          ],
        };
      }
      const handleId = readHandle(input.toolResults);
      if (this.calls % 3 === 2) {
        return {
          responseId: `response_${this.calls}`,
          model: "test-model",
          toolCalls: [
            {
              id: `call_${this.calls}`,
              name: "deliver_json",
              arguments: { resultHandleId: handleId },
            },
          ],
        };
      }
      return {
        responseId: `response_${this.calls}`,
        model: "test-model",
        toolCalls: [
          {
            id: `call_${this.calls}`,
            name: "deliver",
            arguments: { handleId },
          },
        ],
      };
    },
  };
}

function readHandle(results?: ToolResult[]) {
  const output = results?.[0]?.output;
  if (typeof output !== "object" || output === null || !("handleId" in output)) {
    throw new Error("Expected a governed handle from the previous tool call.");
  }
  return String(output.handleId);
}
