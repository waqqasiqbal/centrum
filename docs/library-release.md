# Library installation and release

AI Interfaces is released first as a self-hosted TypeScript library. A consumer runs
the governed runtime inside their own Node.js application and owns the HTTP server,
deployment, database, credentials, and tenant provisioning. A hosted Centrum service
and non-TypeScript SDKs are later products.

## Consumer prerequisites

- Node.js 24 LTS or newer (the catalog uses `node:sqlite`)
- An ESM-compatible TypeScript or JavaScript application
- An OpenAI API key for the OpenAI provider
- A production secret manager for API keys and cursor/artifact secrets

## Install

Install the four published packages:

```bash
npm install @ai-interfaces/core @ai-interfaces/openai \
  @ai-interfaces/catalog @ai-interfaces/renderers
```

The packages are intentionally separate so an application can replace the provider,
catalog, or renderers without installing the reference server or playground.

The published core package also exposes the constrained `wasm-core-v1` transform
runtime used by persisted plans. It is deliberately narrower than a general-purpose
plugin system: modules cannot import host capabilities, receive only bounded row values,
and run with a deadline in a disposable worker. SQL and tenant access remain owned by
the host application and catalog package.

For non-TypeScript clients, run the reference server or your own HTTP wrapper and use
the language samples in [examples/README.md](../examples/README.md). The wire contract
is JSON over HTTP, so Python, JavaScript, Java, Go, Rust, and other languages do not
need the TypeScript packages installed.

## Compose the runtime

The following is the smallest shape of a self-hosted application. The application must
still add its own authenticated HTTP route and pass a server-resolved `Principal`; it
must not accept a tenant ID from a model argument.

```ts
import {
  AIInterfaceRuntime,
  ReadOnlyPolicy,
  createDeliverCapability,
} from "@ai-interfaces/core";
import {
  CatalogDatabase,
  createSearchProductsCapability,
} from "@ai-interfaces/catalog";
import { OpenAIResponsesProvider } from "@ai-interfaces/openai";
import { createRendererCapabilities } from "@ai-interfaces/renderers";

const database = new CatalogDatabase("./data/ai-interfaces.db");
const provider = new OpenAIResponsesProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
});

const runtime = new AIInterfaceRuntime({
  provider,
  capabilities: [
    createSearchProductsCapability(database, process.env.AI_CURSOR_SECRET!),
    ...createRendererCapabilities(database, "./data/artifacts"),
    createDeliverCapability(),
  ],
  policy: new ReadOnlyPolicy(),
});

// principal must come from your authenticated API key/session layer.
const response = await runtime.execute(
  { instruction: "Return my in-stock products as JSON" },
  principal,
  "req_application_123",
);
```

Persisted API management is implemented by the reference server. A consumer that wants
the same behavior in another HTTP stack should persist a tenant-owned plan containing a
validated catalog query, optional JSON pipeline or Wasm transform, and renderer, then
invoke that plan without calling the provider. See the [persisted API guide](persisted-api-builder.md)
and the [Wasm sample](../examples/wasm-runtime/README.md).

This example demonstrates composition only. Before production, the application must
implement authentication, rate limits, request validation, CORS, artifact download
authorization, durable storage, secret management, and audit retention. Read
[SECURITY.md](../SECURITY.md) and [AGENTS.md](../AGENTS.md) before adapting it.

## Package boundary

| Package | Published | Purpose |
| --- | --- | --- |
| `@ai-interfaces/core` | Yes | Runtime, contracts, policy, resources, delivery, errors |
| `@ai-interfaces/openai` | Yes | OpenAI Responses provider |
| `@ai-interfaces/catalog` | Yes | SQLite catalog and product capability reference |
| `@ai-interfaces/renderers` | Yes | Deterministic JSON and PDF renderers |
| `apps/server` | No | Fastify reference application |
| `apps/playground` | No | React/Vite reference UI |

The root workspace remains private. Only the four package directories are release
artifacts. Package versions must be kept compatible across the published set.

## Release process

Publishing is deliberately manual and requires a maintainer review:

1. Update all four package versions together.
2. Update the changelog and migration notes.
3. Run the complete deterministic build, typecheck, unit, and playground checks.
4. Confirm package tarballs contain only `dist`, declarations, source maps, and package
   metadata—never `.env`, `.data`, keys, or logs.
5. Merge the release PR.
6. Run the `Publish packages` GitHub Actions workflow with the configured npm secret.
7. Verify the package versions and install them from a clean external project.

The workflow does not publish the root workspace, server, or playground. It publishes
only non-private packages with public scoped access and provenance enabled.

## Compatibility policy

- Patch releases fix defects without intentional API changes.
- Minor releases may add capabilities, types, and optional configuration.
- Major releases may change runtime contracts, policy semantics, or security boundaries.
- Published packages should share one version number per release train.

