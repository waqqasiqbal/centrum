import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import {
  AIInterfaceError,
  AIInterfaceRuntime,
  ReadOnlyPolicy,
  createDeliverCapability,
  toErrorEnvelope,
  type AgentProvider,
} from "@ai-interfaces/core";
import {
  CatalogDatabase,
  createSearchProductsCapability,
  seedDemo,
} from "@ai-interfaces/catalog";
import { createRendererCapabilities } from "@ai-interfaces/renderers";
import { OpenAIResponsesProvider } from "@ai-interfaces/openai";

const requestSchema = z
  .object({
    instruction: z.string().min(3).max(4_000),
    continuationToken: z.string().max(4_000).nullable().optional(),
    context: z
      .object({
        locale: z.string().max(35).optional(),
        timezone: z.string().max(100).optional(),
      })
      .strict()
      .optional(),
    options: z.object({ includeTrace: z.boolean().optional() }).strict().optional(),
  })
  .strict();

const slugSchema = z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const createPersistedApiSchema = z
  .object({
    slug: slugSchema,
    instruction: z.string().min(3).max(4_000),
    published: z.boolean().default(true),
  })
  .strict();
const updatePersistedApiSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    responseBody: z.json().optional(),
    published: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.responseBody !== undefined || value.published !== undefined, {
    message: "Provide responseBody or published.",
  });

export interface AppOptions {
  databasePath?: string;
  artifactDirectory?: string;
  cursorSecret?: string;
  provider?: AgentProvider;
  logger?: boolean;
  seedIfEmpty?: boolean;
  exposeDemoKeys?: boolean;
}

export async function createApp(options: AppOptions = {}) {
  const databasePath = options.databasePath ?? process.env.AI_DATABASE_PATH ?? ".data/ai-interfaces.db";
  const artifactDirectory =
    options.artifactDirectory ?? process.env.AI_ARTIFACT_DIR ?? ".data/artifacts";
  const database = new CatalogDatabase(databasePath);
  let demoKeys: ReturnType<typeof seedDemo> = [];
  const hasKeys = (
    database.db.prepare("SELECT COUNT(*) as count FROM api_keys").get() as { count: number }
  ).count;
  if (!hasKeys && options.seedIfEmpty !== false) {
    demoKeys = seedDemo(database);
    if (databasePath !== ":memory:") writeDemoKeys(databasePath, demoKeys);
  } else if (databasePath !== ":memory:") {
    demoKeys = readDemoKeys(databasePath);
  }

  const provider = options.provider ?? chooseProvider();
  const cursorSecret = resolveCursorSecret(options.cursorSecret);
  const exposeDemoKeys =
    options.exposeDemoKeys ?? process.env.AI_ENABLE_DEMO_KEYS === "true";
  const capabilities = [
    createSearchProductsCapability(
      database,
      cursorSecret,
    ),
    ...createRendererCapabilities(database, artifactDirectory),
    createDeliverCapability(),
  ];
  const runtime = new AIInterfaceRuntime({
    provider,
    capabilities,
    policy: new ReadOnlyPolicy(),
    maxIterations: 6,
    timeoutMs: 30_000,
  });
  const builderRuntime = new AIInterfaceRuntime({
    provider,
    capabilities: capabilities.filter((capability) => capability.name !== "render_product_pdf"),
    policy: new ReadOnlyPolicy(),
    maxIterations: 6,
    timeoutMs: 30_000,
  });
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 16 * 1024 });
  const limiter = new FixedWindowRateLimiter();
  await app.register(cors, {
    origin: resolveAllowedOrigins(),
    allowedHeaders: ["content-type", "x-ai-interface-key", "idempotency-key"],
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    reply.header("cross-origin-resource-policy", "same-origin");
    reply.header(
      "content-security-policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    reply.header("cache-control", "no-store");
    return payload;
  });

  app.get("/health", async () => ({
    status: "ok",
    protocolVersion: "1.0",
    provider: provider.name,
  }));

  app.get("/v1/demo/keys", async (_request, reply) => {
    if (!exposeDemoKeys || process.env.NODE_ENV === "production") return reply.code(404).send();
    return { keys: demoKeys };
  });

  app.post("/v1/execute", async (request, reply) => {
    const requestId = `req_${randomUUID()}`;
    const startedAt = performance.now();
    try {
      limiter.consume(`ip:${request.ip}`, 60, 60_000);
      const apiKey = getApiKey(request.headers["x-ai-interface-key"]);
      const principal = database.authenticate(apiKey);
      limiter.consume(`principal:${principal.id}`, 20, 60_000);
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AIInterfaceError("INVALID_REQUEST", "The request body is invalid.", 400, {
          issues: parsed.error.issues.map(({ path: issuePath, message }) => ({
            path: issuePath,
            message,
          })),
        });
      }
      request.log.info({
        event: "ai_interface.request",
        requestId,
        tenantId: principal.tenantId,
        idempotencyKeyPresent: Boolean(request.headers["idempotency-key"]),
      });
      const response = await runtime.execute(parsed.data, principal, requestId);
      request.log.info({
        event: "ai_interface.complete",
        requestId,
        tenantId: principal.tenantId,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return reply.code(200).send(response);
    } catch (error) {
      const envelope = toErrorEnvelope(error, requestId, Math.round(performance.now() - startedAt));
      const statusCode = error instanceof AIInterfaceError ? error.statusCode : 500;
      request.log.warn({
        event: "ai_interface.failed",
        requestId,
        code: envelope.error.code,
        durationMs: envelope.trace.durationMs,
        err: error,
      });
      return reply.code(statusCode).send(envelope);
    }
  });

  app.post("/v1/persisted-apis", async (request, reply) => {
    const requestId = `req_${randomUUID()}`;
    const startedAt = performance.now();
    try {
      limiter.consume(`ip:${request.ip}:persisted-manage`, 20, 60_000);
      const principal = database.authenticate(getApiKey(request.headers["x-ai-interface-key"]));
      requirePrincipalCapability(principal.capabilities, "manage_persisted_apis");
      limiter.consume(`principal:${principal.id}:persisted-manage`, 10, 60_000);
      const parsed = parseOrThrow(createPersistedApiSchema, request.body);
      const idempotencyKey = getIdempotencyKey(request.headers["idempotency-key"]);
      const requestHash = stableRequestHash(parsed);
      const existing = database.findPersistedApiByIdempotency(
        principal.tenantId,
        idempotencyKey,
        requestHash,
      );
      if (existing) {
        reply.header("idempotency-replayed", "true");
        return reply.code(200).send(persistedApiEnvelope(existing, requestId));
      }
      if (database.findPersistedApi(parsed.slug, principal.tenantId)) {
        throw new AIInterfaceError(
          "CONFLICT",
          "A persisted API with this slug already exists.",
          409,
        );
      }

      request.log.info({
        event: "persisted_api.build_started",
        requestId,
        tenantId: principal.tenantId,
        slug: parsed.slug,
      });
      const built = await builderRuntime.execute(
        {
          instruction: `${parsed.instruction}\nReturn the result as JSON for a persisted API.`,
          options: { includeTrace: false },
        },
        principal,
        requestId,
      );
      if (built.output.kind !== "data" || built.output.mediaType !== "application/json") {
        throw new AIInterfaceError(
          "UNSUPPORTED_OUTPUT",
          "Persisted APIs currently support JSON responses only.",
        );
      }
      assertJsonSize(built.output.data);
      const record = database.createPersistedApi({
        tenantId: principal.tenantId,
        principalId: principal.id,
        slug: parsed.slug,
        instruction: parsed.instruction,
        responseBody: built.output.data,
        published: parsed.published,
        idempotencyKey,
        requestHash,
      });
      request.log.info({
        event: "persisted_api.created",
        requestId,
        tenantId: principal.tenantId,
        apiId: record.id,
        version: record.version,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return reply.code(201).send(persistedApiEnvelope(record, requestId));
    } catch (error) {
      return sendError(reply, error, requestId, startedAt);
    }
  });

  app.get("/v1/persisted-apis", async (request, reply) => {
    const requestId = `req_${randomUUID()}`;
    const startedAt = performance.now();
    try {
      const principal = database.authenticate(getApiKey(request.headers["x-ai-interface-key"]));
      requirePrincipalCapability(principal.capabilities, "manage_persisted_apis");
      return {
        protocolVersion: "1.0",
        requestId,
        status: "completed",
        apis: database.listPersistedApis(principal.tenantId),
      };
    } catch (error) {
      return sendError(reply, error, requestId, startedAt);
    }
  });

  app.get<{ Params: { slug: string } }>("/v1/persisted-apis/:slug", async (request, reply) => {
    const requestId = `req_${randomUUID()}`;
    const startedAt = performance.now();
    try {
      const principal = database.authenticate(getApiKey(request.headers["x-ai-interface-key"]));
      requirePrincipalCapability(principal.capabilities, "manage_persisted_apis");
      const slug = parseOrThrow(slugSchema, request.params.slug);
      const record = database.findPersistedApi(slug, principal.tenantId);
      if (!record) throw new AIInterfaceError("INVALID_REQUEST", "Persisted API not found.", 404);
      return persistedApiEnvelope(record, requestId);
    } catch (error) {
      return sendError(reply, error, requestId, startedAt);
    }
  });

  app.put<{ Params: { slug: string } }>("/v1/persisted-apis/:slug", async (request, reply) => {
    const requestId = `req_${randomUUID()}`;
    const startedAt = performance.now();
    try {
      limiter.consume(`ip:${request.ip}:persisted-manage`, 20, 60_000);
      const principal = database.authenticate(getApiKey(request.headers["x-ai-interface-key"]));
      requirePrincipalCapability(principal.capabilities, "manage_persisted_apis");
      limiter.consume(`principal:${principal.id}:persisted-manage`, 10, 60_000);
      const slug = parseOrThrow(slugSchema, request.params.slug);
      const parsed = parseOrThrow(updatePersistedApiSchema, request.body);
      if (parsed.responseBody !== undefined) assertJsonSize(parsed.responseBody);
      const record = database.updatePersistedApi({
        tenantId: principal.tenantId,
        principalId: principal.id,
        slug,
        expectedVersion: parsed.expectedVersion,
        ...(parsed.responseBody !== undefined ? { responseBody: parsed.responseBody } : {}),
        ...(parsed.published !== undefined ? { published: parsed.published } : {}),
      });
      request.log.info({
        event: "persisted_api.updated",
        requestId,
        tenantId: principal.tenantId,
        apiId: record.id,
        version: record.version,
      });
      return persistedApiEnvelope(record, requestId);
    } catch (error) {
      return sendError(reply, error, requestId, startedAt);
    }
  });

  app.get<{ Params: { slug: string } }>("/v1/persisted/:slug", async (request, reply) => {
    const requestId = `req_${randomUUID()}`;
    const startedAt = performance.now();
    try {
      limiter.consume(`ip:${request.ip}:persisted-invoke`, 120, 60_000);
      const principal = database.authenticate(getApiKey(request.headers["x-ai-interface-key"]));
      requirePrincipalCapability(principal.capabilities, "invoke_persisted_apis");
      limiter.consume(`principal:${principal.id}:persisted-invoke`, 60, 60_000);
      const slug = parseOrThrow(slugSchema, request.params.slug);
      const record = database.findPersistedApi(slug, principal.tenantId, true);
      if (!record) throw new AIInterfaceError("INVALID_REQUEST", "Persisted API not found.", 404);
      reply.header("x-ai-interface-request-id", requestId);
      reply.header("x-persisted-api-version", String(record.version));
      return reply.code(200).send(record.responseBody);
    } catch (error) {
      return sendError(reply, error, requestId, startedAt);
    }
  });

  app.get<{ Params: { artifactId: string } }>("/v1/artifacts/:artifactId", async (request, reply) => {
    try {
      limiter.consume(`ip:${request.ip}`, 120, 60_000);
      const principal = database.authenticate(getApiKey(request.headers["x-ai-interface-key"]));
      limiter.consume(`principal:${principal.id}:artifact`, 60, 60_000);
      if (!/^artifact_[0-9a-f-]{36}$/.test(request.params.artifactId)) {
        return reply.code(404).send({ error: { code: "INVALID_REQUEST", message: "Artifact not found." } });
      }
      const artifact = database.findArtifact(request.params.artifactId, principal.tenantId);
      const artifactRoot = path.resolve(artifactDirectory);
      const resolvedPath = artifact ? path.resolve(artifact.path) : "";
      if (
        !artifact ||
        !resolvedPath.startsWith(`${artifactRoot}${path.sep}`) ||
        !fs.existsSync(resolvedPath)
      ) {
        return reply.code(404).send({
          error: { code: "INVALID_REQUEST", message: "Artifact not found or expired." },
        });
      }
      reply.header("content-type", artifact.mediaType);
      reply.header("content-disposition", `attachment; filename="${artifact.filename}"`);
      return reply.send(fs.createReadStream(resolvedPath));
    } catch (error) {
      const safe =
        error instanceof AIInterfaceError
          ? error
          : new AIInterfaceError("INTERNAL_ERROR", "Artifact download failed.", 500);
      return reply.code(safe.statusCode).send({ error: { code: safe.code, message: safe.message } });
    }
  });

  app.addHook("onClose", async () => database.close());
  return { app, database, demoKeys, provider };
}

function chooseProvider(): AgentProvider {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required. AI Interfaces has no scripted or non-LLM runtime fallback.",
    );
  }
  return new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
  });
}

function resolveCursorSecret(explicit?: string) {
  const configured = explicit ?? process.env.AI_CURSOR_SECRET;
  if (configured && Buffer.byteLength(configured) >= 32) return configured;
  if (configured) throw new Error("AI_CURSOR_SECRET must be at least 32 bytes.");
  if (process.env.NODE_ENV === "production") {
    throw new Error("AI_CURSOR_SECRET is required in production.");
  }
  return randomBytes(32).toString("base64url");
}

function resolveAllowedOrigins(): Array<string | RegExp> {
  const configured = process.env.AI_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured?.length) {
    return configured.map((origin) => {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
        throw new Error(`Invalid AI_ALLOWED_ORIGINS entry: ${origin}`);
      }
      return origin;
    });
  }
  return process.env.NODE_ENV === "production" ? [] : [/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/];
}

class FixedWindowRateLimiter {
  readonly #windows = new Map<string, { startedAt: number; count: number }>();

  consume(key: string, maximum: number, windowMs: number) {
    const now = Date.now();
    const current = this.#windows.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      this.#windows.set(key, { startedAt: now, count: 1 });
      return;
    }
    if (current.count >= maximum) {
      throw new AIInterfaceError("RATE_LIMITED", "Too many requests. Try again later.", 429);
    }
    current.count += 1;
    if (this.#windows.size > 10_000) {
      for (const [entryKey, value] of this.#windows) {
        if (now - value.startedAt >= windowMs) this.#windows.delete(entryKey);
      }
    }
  }
}

function getApiKey(value: string | string[] | undefined) {
  if (!value || Array.isArray(value)) {
    throw new AIInterfaceError(
      "AUTHENTICATION_FAILED",
      "Provide X-AI-Interface-Key.",
      401,
    );
  }
  return value;
}

function getIdempotencyKey(value: string | string[] | undefined) {
  if (!value || Array.isArray(value) || value.length < 8 || value.length > 200) {
    throw new AIInterfaceError(
      "INVALID_REQUEST",
      "Provide an Idempotency-Key between 8 and 200 characters.",
      400,
    );
  }
  return value;
}

function requirePrincipalCapability(capabilities: string[], required: string) {
  if (!capabilities.includes(required)) {
    throw new AIInterfaceError("POLICY_DENIED", "This API key cannot perform that action.", 403);
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AIInterfaceError("INVALID_REQUEST", "The request is invalid.", 400, {
      issues: parsed.error.issues.map(({ path: issuePath, message }) => ({
        path: issuePath,
        message,
      })),
    });
  }
  return parsed.data;
}

function stableRequestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertJsonSize(value: unknown) {
  if (Buffer.byteLength(JSON.stringify(value)) > 64 * 1024) {
    throw new AIInterfaceError(
      "RESULT_LIMIT_EXCEEDED",
      "Persisted API responses are limited to 64 KiB.",
      413,
    );
  }
}

function persistedApiEnvelope(
  record: import("@ai-interfaces/catalog").PersistedApiRecord,
  requestId: string,
) {
  return {
    protocolVersion: "1.0" as const,
    requestId,
    status: "completed" as const,
    api: {
      id: record.id,
      slug: record.slug,
      instruction: record.instruction,
      responseBody: record.responseBody,
      version: record.version,
      published: record.published,
      invokeUrl: `/v1/persisted/${record.slug}`,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  };
}

function sendError(
  reply: { code(statusCode: number): { send(payload: unknown): unknown } },
  error: unknown,
  requestId: string,
  startedAt: number,
) {
  const envelope = toErrorEnvelope(error, requestId, Math.round(performance.now() - startedAt));
  const statusCode = error instanceof AIInterfaceError ? error.statusCode : 500;
  return reply.code(statusCode).send(envelope);
}

function writeDemoKeys(databasePath: string, keys: ReturnType<typeof seedDemo>) {
  const keysPath = path.join(path.dirname(databasePath), "demo-keys.json");
  fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), { mode: 0o600 });
}

function readDemoKeys(databasePath: string): ReturnType<typeof seedDemo> {
  const keysPath = path.join(path.dirname(databasePath), "demo-keys.json");
  try {
    return JSON.parse(fs.readFileSync(keysPath, "utf8")) as ReturnType<typeof seedDemo>;
  } catch {
    return [];
  }
}
