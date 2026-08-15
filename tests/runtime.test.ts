import { describe, expect, it } from "vitest";
import {
  AIInterfaceRuntime,
  ReadOnlyPolicy,
  createDeliverCapability,
  type AgentProvider,
  type Capability,
  type DeliveryValue,
  type Principal,
} from "../packages/core/src/index.js";

const principal: Principal = {
  id: "key_runtime_test",
  tenantId: "tenant_runtime_test",
  tenantName: "Runtime Test",
  capabilities: ["search_products", "deliver_json", "deliver"],
};

type EmptyInput = Record<string, never>;
type RenderInput = { resultHandleId: string };

const emptySchema = {
  safeParse(value: unknown) {
    if (typeof value === "object" && value !== null && Object.keys(value).length === 0) {
      return { success: true as const, data: value as EmptyInput };
    }
    return {
      success: false as const,
      error: { issues: [{ path: [], message: "Expected an empty object" }] },
    };
  },
} as Capability<EmptyInput>["inputSchema"];

const renderSchema = {
  safeParse(value: unknown) {
    if (
      typeof value === "object" &&
      value !== null &&
      Object.keys(value).length === 1 &&
      typeof (value as Record<string, unknown>).resultHandleId === "string"
    ) {
      return { success: true as const, data: value as RenderInput };
    }
    return {
      success: false as const,
      error: { issues: [{ path: ["resultHandleId"], message: "Expected a string" }] },
    };
  },
} as Capability<RenderInput>["inputSchema"];

function createCapabilities(): Capability[] {
  const search: Capability<EmptyInput> = {
    name: "search_products",
    description: "Search products.",
    inputSchema: emptySchema,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      context.resources.put({
        id: "products_test",
        type: "product_set",
        tenantId: context.principal.tenantId,
        value: [{ id: "product_1" }],
      });
      return { handleId: "products_test", resultCount: 1 };
    },
  };

  const render: Capability<RenderInput> = {
    name: "deliver_json",
    description: "Render products as JSON.",
    inputSchema: renderSchema,
    parameters: {
      type: "object",
      properties: { resultHandleId: { type: "string" } },
      required: ["resultHandleId"],
      additionalProperties: false,
    },
    async execute({ resultHandleId }, context) {
      context.resources.get(resultHandleId, context.principal.tenantId, "product_set");
      const delivery: DeliveryValue = {
        output: {
          kind: "data",
          mediaType: "application/json",
          data: [{ id: "product_1" }],
        },
      };
      context.resources.put({
        id: "prepared_test",
        type: "prepared_delivery",
        tenantId: context.principal.tenantId,
        value: delivery,
      });
      return { handleId: "prepared_test", resultCount: 1 };
    },
  };

  return [search, render, createDeliverCapability()];
}

describe("AIInterfaceRuntime", () => {
  it("completes the governed sequence and exposes only phase-appropriate tools", async () => {
    const exposedTools: string[][] = [];
    const calls = [
      { id: "call_search", name: "search_products", arguments: {} },
      {
        id: "call_render",
        name: "deliver_json",
        arguments: { resultHandleId: "products_test" },
      },
      { id: "call_deliver", name: "deliver", arguments: { handleId: "prepared_test" } },
    ];
    const provider: AgentProvider = {
      name: "scripted-provider",
      async run(input) {
        exposedTools.push(input.tools.map(({ name }) => name));
        const toolCall = calls[exposedTools.length - 1];
        return {
          responseId: `response_${exposedTools.length}`,
          model: "scripted-model",
          toolCalls: [toolCall],
        };
      },
    };
    const runtime = new AIInterfaceRuntime({
      provider,
      capabilities: createCapabilities(),
      policy: new ReadOnlyPolicy(),
    });

    const response = await runtime.execute(
      { instruction: "List products as JSON", options: { includeTrace: true } },
      principal,
    );

    expect(response).toMatchObject({
      status: "completed",
      output: { kind: "data", data: [{ id: "product_1" }] },
      trace: {
        capabilitiesUsed: ["search_products", "deliver_json", "deliver"],
        provider: "scripted-provider",
        model: "scripted-model",
      },
    });
    expect(exposedTools).toEqual([
      ["search_products"],
      ["deliver_json"],
      ["deliver"],
    ]);
  });

  it("rejects multiple capability calls in one provider turn", async () => {
    const provider: AgentProvider = {
      name: "multi-call-provider",
      async run() {
        return {
          responseId: "response_1",
          model: "test",
          toolCalls: [
            { id: "call_1", name: "search_products", arguments: {} },
            { id: "call_2", name: "search_products", arguments: {} },
          ],
        };
      },
    };
    const runtime = new AIInterfaceRuntime({
      provider,
      capabilities: createCapabilities(),
      policy: new ReadOnlyPolicy(),
    });

    await expect(runtime.execute({ instruction: "List products" }, principal)).rejects.toMatchObject({
      code: "POLICY_DENIED",
      statusCode: 403,
    });
  });

  it("rejects provider arguments that fail the capability schema", async () => {
    const provider: AgentProvider = {
      name: "invalid-arguments-provider",
      async run() {
        return {
          responseId: "response_1",
          model: "test",
          toolCalls: [{ id: "call_1", name: "search_products", arguments: { extra: true } }],
        };
      },
    };
    const runtime = new AIInterfaceRuntime({
      provider,
      capabilities: createCapabilities(),
      policy: new ReadOnlyPolicy(),
    });

    await expect(runtime.execute({ instruction: "List products" }, principal)).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      details: { issues: expect.any(Array) },
    });
  });
});
