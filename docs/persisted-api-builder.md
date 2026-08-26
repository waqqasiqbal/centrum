# Persisted API builder

The persisted API builder compiles one governed LLM interaction into a tenant-owned,
validated execution artifact. Creating the API invokes the model once. Invoking or editing
the saved artifact executes deterministic capabilities and does not invoke the model.

Use `POST /v1/execute` when each request needs fresh interpretation. Use a persisted API
when a client wants a repeatable API over its own data without paying for model
interpretation on every request.

## Current artifact versus the target vision

Today, creation compiles the LLM's validated tool calls into a typed JSON plan. The
plan describes an allowlisted catalog query, an optional `pick`/`rename` pipeline, and
the JSON renderer. Centrum executes that plan with trusted host code, injecting tenant
scope and compiling the query into parameterized SQL. It does not persist a model
response as a cache, and it does not execute arbitrary generated JavaScript, Python, or
raw SQL.

The current code-bearing option is an explicitly supplied, precompiled
`wasm-core-v1` module. It runs in an import-free worker and can only perform the
documented bounded transform. The planned executable API pipeline will let the LLM
author a typed query IR, source code, schemas, and tests; an isolated compiler will
produce the Wasm artifact, which a client can review and publish. See the
[executable API roadmap](executable-api-roadmap.md) and
[ADR 0004](adr/0004-executable-api-artifacts.md).

## Build an API with the LLM

Creation requires an API key with `manage_persisted_apis` and an idempotency key.

```bash
curl http://localhost:3000/v1/persisted-apis \
  -X POST \
  -H 'content-type: application/json' \
  -H 'x-ai-interface-key: YOUR_API_KEY' \
  -H 'idempotency-key: featured-products-v1' \
  -d '{
    "slug": "featured-products",
    "instruction": "Return active outdoor products under €150 as JSON",
    "published": true
  }'
```

The server runs the normal governed sequence with only the JSON renderer available,
captures the validated `search_products` query, optional bounded `transform_json` pipeline,
optional code-bearing `wasm` transform, and JSON renderer as a typed artifact, stores that
artifact and a preview output, and returns
its management record and invoke URL.

Retry the same creation request with the same idempotency key to retrieve the existing
result without another model call. Reusing that key with different input returns
`409 CONFLICT`.

## Invoke without an LLM

Invocation requires `invoke_persisted_apis` authority:

```bash
curl http://localhost:3000/v1/persisted/featured-products \
  -H 'x-ai-interface-key: YOUR_API_KEY'
```

The server executes the stored query and renderer against the authenticated tenant's
current data. The response is produced without a provider call. These headers provide
operational metadata:

- `x-ai-interface-request-id`
- `x-persisted-api-version`

The provider is not called on this path. Published routes remain authenticated and
tenant-scoped.

## Inspect and list

```bash
curl http://localhost:3000/v1/persisted-apis \
  -H 'x-ai-interface-key: YOUR_API_KEY'

curl http://localhost:3000/v1/persisted-apis/featured-products \
  -H 'x-ai-interface-key: YOUR_API_KEY'
```

The list omits plan and preview bodies. Fetch a specific management record to inspect
the compiled plan.

## Modify without an LLM

Updates require the version most recently read from the management API:

```bash
curl http://localhost:3000/v1/persisted-apis/featured-products \
  -X PUT \
  -H 'content-type: application/json' \
  -H 'x-ai-interface-key: YOUR_API_KEY' \
  -d '{
    "expectedVersion": 1,
    "plan": {
      "version": 1,
      "renderer": "json",
      "search": {
        "filters": [],
        "sort": { "field": "name", "direction": "asc" },
        "limit": 10,
        "projection": ["id", "name", "price"],
        "cursor": null
      }
    }
  }'
```

Each successful plan edit increments the version and records an immutable plan snapshot
and audit event. A stale `expectedVersion` returns `409 CONFLICT` instead of overwriting
another change.

Set `published` to `false` in the same update shape to stop invocation while retaining
the API and its history. Set it back to `true` with the latest version to republish.

## Add a code-bearing transform

Persisted plans can add a constrained Wasm step after the catalog query. The step is
useful when the required response needs deterministic business logic that is more
expressive than `pick` and `rename`, while still avoiding an LLM call at invocation time.
The plan fragment below applies the `transform_i32` function from the checked-in
[sample artifact](../examples/wasm-runtime/artifact.json) to `stock` and writes
`stockWithBonus`:

```json
{
  "version": 1,
  "renderer": "json",
  "search": {
    "filters": [],
    "sort": { "field": "name", "direction": "asc" },
    "limit": 10,
    "projection": ["id", "name", "stock"],
    "cursor": null
  },
  "wasm": {
    "version": 1,
    "runtime": "wasm-core-v1",
    "moduleBase64": "<base64 WebAssembly module>",
    "entrypoint": "transform_i32",
    "inputField": "stock",
    "outputField": "stockWithBonus",
    "timeoutMs": 100
  }
}
```

The server validates the artifact during the versioned update, executes the query for
the authenticated tenant, applies the Wasm transform in a disposable worker, and then
renders the resulting rows. The module cannot import host functions or access SQL,
files, network, credentials, or tenant identity. This v1 contract is intentionally
limited to one integer input and one integer output per row.

## Limits and security

- Slugs contain lowercase letters, numbers, and single hyphens and are 3–80 characters.
- Stored JSON is limited to 64 KiB; the server's 16 KiB HTTP body limit also bounds
  manual edit requests.
- Creation supports JSON only; expiring PDF artifacts cannot be persisted.
- The compiled artifact runs against current catalog data. Its optional `json-pipeline-v1`
  stage supports bounded `pick` and `rename` operations. Its optional `wasm-core-v1` stage
  stores a validated WebAssembly module and applies one `i32 -> i32` transform per row;
  modules cannot import host capabilities and run in a disposable worker with a timeout.
- Raw SQL, templates, credentials, custom headers, paths, and URLs are not accepted in
  plans. SQL remains host-controlled and read-only; see the [Wasm sample](../examples/wasm-runtime/README.md)
  for a code-bearing transform.
- Tenant identity comes from the authenticated principal, never from request data.

See [ADR 0003](adr/0003-persisted-api-builder.md) for the authority, idempotency,
versioning, and audit design.
