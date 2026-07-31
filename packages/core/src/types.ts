import type { z } from "zod";

export interface Principal {
  id: string;
  tenantId: string;
  tenantName: string;
  capabilities: string[];
}

export interface ExecuteRequest {
  instruction: string;
  continuationToken?: string | null;
  context?: {
    locale?: string;
    timezone?: string;
  };
  options?: {
    includeTrace?: boolean;
  };
}

export interface JsonSchema {
  [key: string]: unknown;
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface ToolResult {
  callId: string;
  name: string;
  output: unknown;
  isError?: boolean;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ProviderTurn {
  responseId: string;
  toolCalls: ToolCall[];
  model: string;
  usage?: ProviderUsage;
}

export interface AgentProvider {
  readonly name: string;
  run(input: {
    instruction: string;
    tools: ToolDefinition[];
    previousResponseId?: string;
    toolResults?: ToolResult[];
    safetyIdentifier: string;
    signal: AbortSignal;
  }): Promise<ProviderTurn>;
}

export interface TraceEvent {
  type: "model_call" | "tool_call" | "policy" | "render" | "complete";
  name: string;
  durationMs?: number;
  arguments?: unknown;
  resultCount?: number;
  decision?: string;
}

export interface Resource<T = unknown> {
  id: string;
  type: string;
  tenantId: string;
  value: T;
}

export interface DeliveryValue {
  output:
    | {
        kind: "data";
        mediaType: "application/json";
        data: unknown;
      }
    | {
        kind: "artifact";
        mediaType: "application/pdf";
        artifact: {
          id: string;
          filename: string;
          byteSize: number;
          expiresAt: string;
          downloadUrl: string;
        };
      };
  pagination?: {
    nextToken: string | null;
    hasMore: boolean;
  };
  warnings?: string[];
}

export interface CapabilityContext {
  principal: Principal;
  request: ExecuteRequest;
  resources: ResourceStore;
  signal: AbortSignal;
  emit(event: TraceEvent): void;
}

export interface Capability<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  parameters: JsonSchema;
  execute(input: TInput, context: CapabilityContext): Promise<unknown>;
}

export interface Policy {
  preflight(request: ExecuteRequest, principal: Principal): void;
  canUse(capability: Capability, principal: Principal): boolean;
}

export class ResourceStore {
  readonly #resources = new Map<string, Resource>();

  put<T>(resource: Resource<T>): Resource<T> {
    this.#resources.set(resource.id, resource);
    return resource;
  }

  get<T>(id: string, tenantId: string, type?: string): Resource<T> {
    const resource = this.#resources.get(id);
    if (!resource || resource.tenantId !== tenantId || (type && resource.type !== type)) {
      throw new Error("Resource handle is invalid or outside the current tenant.");
    }
    return resource as Resource<T>;
  }
}
