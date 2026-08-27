# Centrum TODO

This is the execution backlog for the current roadmap. Keep it focused on concrete,
verifiable work. Larger changes should first be reflected in [`ROADMAP.md`](ROADMAP.md).

## Product rule

Centrum must enable a provider to offer governed, client-programmable API
environments. Clients should be able to create multiple APIs as their needs change;
the provider should not need to build a new fixed API contract for every request.

## P0 — make the public demo usable

- [x] Deploy the React playground to Vercel.
- [ ] Deploy the Fastify API to a public backend host.
- [ ] Configure the playground with the deployed API origin.
- [ ] Run an end-to-end smoke test against the public playground.
- [ ] Document the public demo URL and its current limitations.
- [ ] Add a demo showing one provider environment and multiple client-created APIs.
- [ ] Add a demo showing API edit, version, publish, rollback, and retirement.

## P1 — production database foundation

- [ ] Define a database adapter interface shared by SQLite and PostgreSQL.
- [ ] Add PostgreSQL migrations for tenants, keys, catalog data, artifacts,
  persisted APIs, idempotency records, and audit history.
- [ ] Implement PostgreSQL catalog and persisted-API repositories.
- [ ] Preserve tenant scoping, parameterized queries, and read-only policy checks.
- [ ] Separate provider-owned environment policy from client-owned API definitions.
- [ ] Add client namespaces, quotas, permissions, and audit visibility.
- [ ] Add SQLite/PostgreSQL parity tests for core API flows.
- [ ] Select the first managed provider; current recommendation: Render PostgreSQL.
- [ ] Add backup, restore, credential rotation, and migration runbooks.

## P1 — executable API platform

- [ ] Define the typed query IR for joins, unions, filters, grouping, and aggregations.
- [ ] Compile the query IR into safe parameterized SQL owned by Centrum.
- [ ] Define the generated transformation source contract.
- [ ] Compile approved transformations into bounded Wasm artifacts.
- [ ] Add generated contract tests and example-based regression tests.
- [ ] Add draft, validation, review, publish, rollback, and deprecation states.
- [ ] Support multiple independently versioned APIs per client and environment.
- [ ] Add execution metrics for latency, failures, provider calls avoided, and database cost.

## P2 — open-source adoption

- [ ] Add a visual persisted-plan inspector to the playground.
- [ ] Add generated OpenAPI output and a small Python client.
- [ ] Add cost and latency comparisons to the analytics demo.
- [ ] Clarify the Centrum and `@ai-interfaces/*` naming relationship.
- [ ] Publish a technical walkthrough of the governed executable-API model.
- [ ] Create maintained `good first issue` and `help wanted` tasks.

## Decisions to record

- [ ] Record the final database provider and migration decision in an ADR.
- [ ] Record the Vercel frontend plus backend-hosting architecture in the demo documentation.
- [ ] Record production data retention, backup, and tenant-isolation policies.

## Completed recently

- [x] Persisted API versions and audit history.
- [x] Integrity-checked Wasm artifact foundation.
- [x] Flagship multi-table analytics example.
- [x] Vercel production deployment of the React playground.
