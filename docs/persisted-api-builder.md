# Persisted API builder

The persisted API builder compiles one governed LLM interaction into a tenant-owned,
validated execution plan. Creating the API invokes the model once. Invoking or editing
the saved plan executes deterministic capabilities and does not invoke the model.

Use `POST /v1/execute` when each request needs fresh interpretation. Use a persisted API
when a client wants a repeatable API over its own data without paying for model
interpretation on every request.

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
captures the validated `search_products` query and JSON renderer as a typed plan, stores
that plan and a preview output, and returns its management record and invoke URL.

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

## Limits and security

- Slugs contain lowercase letters, numbers, and single hyphens and are 3–80 characters.
- Stored JSON is limited to 64 KiB; the server's 16 KiB HTTP body limit also bounds
  manual edit requests.
- Creation supports JSON only; expiring PDF artifacts cannot be persisted.
- The compiled plan runs against current catalog data; it does not store executable
  handler code.
- No arbitrary code, templates, SQL, credentials, custom headers, paths, or URLs are
  accepted. Plans contain only allowlisted capability arguments.
- Tenant identity comes from the authenticated principal, never from request data.

See [ADR 0003](adr/0003-persisted-api-builder.md) for the authority, idempotency,
versioning, and audit design.
