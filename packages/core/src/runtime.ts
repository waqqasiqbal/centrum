import { createHash, randomUUID } from "node:crypto";
import { AIInterfaceError } from "./errors.js";
import type {
  AgentProvider,
  Capability,
  DeliveryValue,
  ExecuteRequest,
  Policy,
  Principal,
  ProviderUsage,
  ToolResult,
  TraceEvent,
} from "./types.js";
import { ResourceStore } from "./types.js";

export interface RuntimeOptions {
  provider: AgentProvider;
  capabilities: Capability[];
  policy: Policy;
  maxIterations?: number;
  timeoutMs?: number;
}

export class AIInterfaceRuntime {
  readonly #provider: AgentProvider;
  readonly #capabilities: Map<string, Capability>;
  readonly #policy: Policy;
  readonly #maxIterations: number;
  readonly #timeoutMs: number;

  constructor(options: RuntimeOptions) {
    this.#provider = options.provider;
    this.#capabilities = new Map(options.capabilities.map((item) => [item.name, item]));
    this.#policy = options.policy;
    this.#maxIterations = options.maxIterations ?? 6;
    this.#timeoutMs = options.timeoutMs ?? 30_000;
  }

  async execute(request: ExecuteRequest, principal: Principal, requestId = `req_${randomUUID()}`) {
    const startedAt = performance.now();
    this.#policy.preflight(request, principal);
    const capabilities = [...this.#capabilities.values()].filter((capability) =>
      this.#policy.canUse(capability, principal),
    );
    const resources = new ResourceStore();
    const traceEvents: TraceEvent[] = [];
    const used = new Set<string>();
    let usage: ProviderUsage = {};
    let continuationToken: string | undefined;
    let toolResults: ToolResult[] | undefined;
    let model = this.#provider.name;
    let phase: "search" | "render" | "deliver" = "search";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      for (let iteration = 0; iteration < this.#maxIterations; iteration += 1) {
        const modelStarted = performance.now();
        const phaseCapabilities = capabilities.filter((capability) =>
          allowedInPhase(capability.name, phase),
        );
        const turn = await this.#provider.run({
          instruction: request.instruction,
          safetyIdentifier: createHash("sha256")
            .update(`${principal.tenantId}:${principal.id}`)
            .digest("hex"),
          continuationToken,
          toolResults,
          signal: controller.signal,
          tools: phaseCapabilities.map(({ name, description, parameters }) => ({
            name,
            description,
            parameters,
          })),
        });
        model = turn.model;
        usage = mergeUsage(usage, turn.usage);
        traceEvents.push({
          type: "model_call",
          name: this.#provider.name,
          durationMs: Math.round(performance.now() - modelStarted),
        });
        continuationToken = turn.continuationToken;

        if (turn.toolCalls.length === 0) {
          throw new AIInterfaceError(
            "NEEDS_CLARIFICATION",
            "The request did not produce a deliverable result. Restate the desired product data and output format.",
          );
        }

        if (turn.toolCalls.length !== 1) {
          throw new AIInterfaceError(
            "POLICY_DENIED",
            "The model attempted an invalid multi-capability action.",
            403,
          );
        }

        toolResults = [];
        for (const call of turn.toolCalls) {
          const capability = this.#capabilities.get(call.name);
          if (!capability || !this.#policy.canUse(capability, principal)) {
            throw new AIInterfaceError(
              "POLICY_DENIED",
              `Capability '${call.name}' is not available to this API key.`,
              403,
            );
          }
          if (!allowedInPhase(call.name, phase)) {
            throw new AIInterfaceError(
              "POLICY_DENIED",
              `Capability '${call.name}' is not allowed during the ${phase} phase.`,
              403,
            );
          }

          const parsed = capability.inputSchema.safeParse(call.arguments);
          if (!parsed.success) {
            throw new AIInterfaceError("INVALID_REQUEST", `Invalid arguments for '${call.name}'.`, 400, {
              issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
            });
          }

          const toolStarted = performance.now();
          const output = await capability.execute(parsed.data, {
            principal,
            request,
            resources,
            signal: controller.signal,
            emit: (event) => traceEvents.push(event),
          });
          used.add(call.name);
          traceEvents.push({
            type: "tool_call",
            name: call.name,
            durationMs: Math.round(performance.now() - toolStarted),
            arguments: redactArguments(call.name, parsed.data),
            ...(isResultCount(output) ? { resultCount: output.resultCount } : {}),
          });
          toolResults.push({ callId: call.id, name: call.name, output });

          if (call.name === "search_products") phase = "render";
          else if (call.name === "deliver_json" || call.name === "render_product_pdf") {
            phase = "deliver";
          }

          if (call.name === "deliver") {
            const deliveredHandleId = (output as { handleId: string }).handleId;
            const delivery = resources.get<DeliveryValue>(
              deliveredHandleId,
              principal.tenantId,
              "delivery",
            ).value;
            const durationMs = Math.round(performance.now() - startedAt);
            return {
              protocolVersion: "1.0" as const,
              requestId,
              status: "completed" as const,
              output: delivery.output,
              ...(delivery.pagination ? { pagination: delivery.pagination } : {}),
              ...(request.options?.includeTrace
                ? {
                    trace: {
                      capabilitiesUsed: [...used],
                      policyDecisions: ["tenant_scope_injected", "read_only_capabilities"],
                      events: traceEvents,
                      provider: this.#provider.name,
                      model,
                      usage,
                      durationMs,
                    },
                  }
                : { trace: { durationMs } }),
              warnings: delivery.warnings ?? [],
            };
          }
        }
      }
      throw new AIInterfaceError(
        "MODEL_TIMEOUT",
        `The agent exceeded the ${this.#maxIterations}-iteration execution limit.`,
        504,
      );
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AIInterfaceError("MODEL_TIMEOUT", "The agent exceeded the request deadline.", 504);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function allowedInPhase(name: string, phase: "search" | "render" | "deliver") {
  if (phase === "search") return name === "search_products";
  if (phase === "render") {
    return name === "transform_json" || name === "deliver_json" || name === "render_product_pdf";
  }
  return name === "deliver";
}

function mergeUsage(current: ProviderUsage, next?: ProviderUsage): ProviderUsage {
  return {
    inputTokens: (current.inputTokens ?? 0) + (next?.inputTokens ?? 0),
    outputTokens: (current.outputTokens ?? 0) + (next?.outputTokens ?? 0),
    totalTokens: (current.totalTokens ?? 0) + (next?.totalTokens ?? 0),
  };
}

function redactArguments(name: string, value: unknown): unknown {
  return name === "deliver" ? value : JSON.parse(JSON.stringify(value));
}

function isResultCount(value: unknown): value is { resultCount: number } {
  return typeof value === "object" && value !== null && "resultCount" in value;
}
