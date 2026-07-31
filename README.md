# AI Interfaces

AI Interfaces is an experimental TypeScript framework for governed agentic APIs.
Clients describe an outcome in natural language; a model selects typed capabilities;
deterministic application code enforces authority, reads canonical data, renders the
result, and returns a versioned response envelope.

The reference prototype supports tenant-scoped product queries as JSON or PDF.

## Why this is different

An AI Interface is not a prompt placed in front of unrestricted application code.
The model receives a small capability registry and can only exchange opaque resource
handles between tools:

```text
instruction → policy → model plan → typed capability → resource handle
            → deterministic renderer → deliver → versioned envelope
```

- The model controls interpretation and sequencing.
- The policy layer controls authority.
- Repositories control business truth and tenant isolation.
- Renderers control public data and files.
- Traces expose tool decisions without exposing hidden reasoning.

## Run the prototype

Requirements: Node.js 22 or newer.

```bash
npx pnpm@10.14.0 install
npx pnpm@10.14.0 demo:seed
npx pnpm@10.14.0 dev
```

Open [http://localhost:5173](http://localhost:5173). The playground discovers the
two local development tenants created by the seed command.

The prototype always uses a real LLM through the OpenAI Responses API. It intentionally
has no scripted or non-LLM fallback:

```bash
cp .env.example .env
# Add OPENAI_API_KEY, then load the environment in your shell.
npx pnpm@10.14.0 dev
```

The default live model is `gpt-5.6-terra`; override it with `OPENAI_MODEL`.

## Call the interface

The seed command prints development keys once and writes an ignored local copy to
`.data/demo-keys.json`.

```bash
curl http://localhost:3000/v1/execute \
  -H 'content-type: application/json' \
  -H 'x-ai-interface-key: YOUR_LOCAL_DEMO_KEY' \
  -d '{
    "instruction": "Return my in-stock products over €20, sorted by price descending, 5 per page, as JSON.",
    "options": { "includeTrace": true }
  }'
```

Use the returned `pagination.nextToken` as `continuationToken` in the next request.
PDF results contain an authenticated `/v1/artifacts/:artifactId` download URL.

## Workspace

| Package | Responsibility |
| --- | --- |
| `@ai-interfaces/core` | Runtime, provider contract, policy, resources, errors, delivery |
| `@ai-interfaces/openai` | OpenAI Responses API provider |
| `@ai-interfaces/catalog` | SQLite repository, authentication, product capability |
| `@ai-interfaces/renderers` | Deterministic JSON and PDF delivery |
| `apps/server` | Fastify reference API |
| `apps/playground` | React/Vite execution playground |

## Security invariants

- API keys resolve tenant identity before the model runs.
- `tenantId` is never a model-controlled tool argument.
- Product queries use a validated AST and allowlisted SQL fragments.
- Cursor tokens are signed and bound to tenant and sort order.
- Resource handles are request-local, opaque, typed, and tenant-scoped.
- The v1 policy is read-only; there are no shell, filesystem, URL, SQL, or mutation tools.
- Artifact metadata and downloads are tenant-scoped and expire after one hour.
- Tool traces expose bounded audit data, never chain-of-thought.

The demo endpoint exposing local keys requires `AI_ENABLE_DEMO_KEYS=true` and is always
disabled when `NODE_ENV=production`. Production also requires a 32-byte-or-longer
`AI_CURSOR_SECRET`; without one the server fails closed.
See [SECURITY.md](SECURITY.md) before adapting this prototype for production.

## Verification

```bash
npx pnpm@10.14.0 typecheck
npx pnpm@10.14.0 test
npx pnpm@10.14.0 build
```

`pnpm test` runs deterministic policy unit tests and then the mandatory live LLM
end-to-end suite. It fails fast when `OPENAI_API_KEY` is absent. Use `pnpm test:unit`
only when working on non-agent policy code. `evals/product-requests.json` contains 30
representative and adversarial requests for broader live-model evaluation.

## Status

This is a `0.1.0` research prototype. Writes with approval, persistent sessions,
background jobs, more renderers, PostgreSQL, and additional providers are intentionally
outside v1.

Licensed under Apache 2.0.
