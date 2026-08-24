# ADR 0003: Persisted deterministic APIs

Status: Accepted

## Context

The interactive execution path invokes an LLM on every request. That is appropriate
when each request needs fresh intent interpretation, but it is unnecessarily expensive
when a tenant wants a repeatable API over its own data.

Treating this as an opaque response cache would make ownership, edits, publication,
auditing, and invalidation unclear. Allowing the model to create unrestricted executable
handlers, SQL, templates, or arbitrary headers would also violate the framework's
authority boundaries.

ADR 0002 keeps v1 model-facing capabilities read-only and requires a separate mutation,
idempotency, and audit design. Persisted API management is that separate design. It is
an authenticated server operation and is never exposed as a model tool.

## Decision

Add tenant-owned persisted JSON APIs with two execution modes:

1. Interactive execution continues to use the LLM for every request through
   `POST /v1/execute`.
2. API builder creation invokes the governed read-only runtime once, captures the
   validated query, optional bounded JSON transformation pipeline, optional constrained
   `wasm-core-v1` transform, and renderer as a typed execution artifact, and executes
   that artifact later without invoking a provider. A preview response may be retained for
   inspection, but it is not the invocation source of truth.

Persisted API creation requires an idempotency key. The key is stored only as a hash and
is bound to the tenant and request hash. Reuse with an identical request returns the
existing API; reuse with another request fails with a conflict.

Manual changes use optimistic concurrency through `expectedVersion`. Every successful
creation and update writes an immutable version row and a tenant/principal-scoped audit
event. Publication can be enabled or disabled without deleting history.

API keys require explicit `manage_persisted_apis` or `invoke_persisted_apis` authority.
Slug lookup, management, invocation, idempotency, versions, and audit rows are all
tenant-scoped.

## Initial limitations

- Responses are JSON and limited to 64 KiB.
- Creation uses the existing product search and deterministic JSON renderer.
- PDF artifacts are excluded because they expire.
- Persisted artifacts currently target product search, an optional `json-pipeline-v1`
  transformation (`pick`/`rename`), an optional `wasm-core-v1` per-row `i32 -> i32`
  transform, and JSON renderer; they execute against current tenant data.
- Wasm modules are base64-encoded artifacts, limited in size, import-free, restricted to
  the `transform_i32` entrypoint, capped at 1,000 rows and 1,000 ms, and run in a
  disposable worker. They cannot access SQL, files, network, credentials, or host APIs.
- There are no unrestricted executable templates, headers, raw SQL, URLs, filesystem
  paths, scripts, or user-provided JavaScript in persisted plans.
- Regeneration, rollback, deletion, parameters, custom methods, schemas, and public
  unauthenticated routes are future work.

## Consequences

Repeated invocation has no model token cost and deterministic latency. Tenants can edit
and publish plans explicitly while the LLM remains an authoring/compiler aid rather than
a runtime authority.

The feature introduces narrowly scoped persistence mutations, but it does not change
the read-only model capability sequence. Callers must decide when a snapshot is
appropriate and explicitly rebuild or edit it when requirements change.

