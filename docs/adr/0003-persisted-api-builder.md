# ADR 0003: Persisted deterministic APIs

Status: Accepted

## Context

The interactive execution path invokes an LLM on every request. That is appropriate
when each request needs fresh intent interpretation, but it is unnecessarily expensive
when a tenant wants to publish a response and change it only occasionally.

Treating this as an opaque response cache would make ownership, edits, publication,
auditing, and invalidation unclear. Allowing the model to create executable handlers,
SQL, templates, or arbitrary headers would also violate the framework's authority
boundaries.

ADR 0002 keeps v1 model-facing capabilities read-only and requires a separate mutation,
idempotency, and audit design. Persisted API management is that separate design. It is
an authenticated server operation and is never exposed as a model tool.

## Decision

Add tenant-owned persisted JSON APIs with two execution modes:

1. Interactive execution continues to use the LLM for every request through
   `POST /v1/execute`.
2. API builder creation invokes the governed read-only runtime once, persists the
   canonical JSON delivery, and serves it later without invoking a provider.

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
- Persisted responses are snapshots; they do not automatically follow source-data
  changes.
- There are no executable templates, arbitrary headers, SQL, URLs, filesystem paths,
  scripts, or user-provided code.
- Regeneration, rollback, deletion, parameters, custom methods, schemas, and public
  unauthenticated routes are future work.

## Consequences

Repeated invocation has no model token cost and deterministic latency. Tenants can edit
and publish responses explicitly while the LLM remains an authoring aid rather than a
runtime authority.

The feature introduces narrowly scoped persistence mutations, but it does not change
the read-only model capability sequence. Callers must decide when a snapshot is
appropriate and explicitly rebuild or edit it when canonical source data changes.
