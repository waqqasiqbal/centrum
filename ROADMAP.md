# Centrum roadmap

Centrum lets companies offer clients a governed environment where they can use an
LLM to create, test, publish, revise, and run APIs around approved data. This
roadmap keeps the project focused on proving that flexible client-programmable
model, making the repository easy to adopt, and building trust with open-source
users.

The day-to-day execution backlog is maintained in [`TODO.md`](TODO.md). Update the
backlog when work starts or finishes, and update this roadmap when priorities,
phases, or architectural direction change.

## Product vision

A company provides the data environment, capabilities, policies, and runtime.
Each client can then generate multiple APIs for changing business needs without
waiting for the company to design and ship a new fixed integration every time.
Centrum governs what clients may access and turns approved generated definitions
into independently runnable API versions.

The generated API is not a one-time response or a permanent contract frozen at
the first request. It is a client-owned, versioned capability that can be edited,
tested, published, rolled back, and retired while remaining inside the provider's
security and data policies.

## North-star outcome

A platform provider can onboard a client to a governed data environment. The client
can describe new workflows whenever needed, inspect the generated query and logic,
persist each approved workflow as a tenant-owned API, and invoke it repeatedly with
predictable cost, latency, authorization, and audit behavior.

## Current baseline

- Self-hosted TypeScript packages for the governed runtime, catalog, renderers, and
  OpenAI provider.
- Reference Fastify server and React playground.
- JSON-over-HTTP examples for Python, JavaScript, Java, Go, and Rust.
- Versioned persisted APIs with idempotent creation, optimistic updates, publication,
  tenant scoping, and audit history.
- Constrained `wasm-core-v1` transforms that run without host imports in a disposable
  worker.
- React playground deployed to Vercel as `centrum-playground.vercel.app`.
- Backend and database remain to be deployed; the current reference database is
  local SQLite.
- The product direction is client-programmable APIs in provider-owned environments,
  not a catalog of fixed APIs created once by the provider.

## Phase 1 — make the promise obvious (next 30 days)

- [x] Publish a one-command local demo that shows provider calls changing from one to
  zero after API persistence.
- [ ] Demonstrate one provider environment serving multiple clients, with each
  client creating and invoking more than one persisted API.
- [ ] Show an existing client API being edited, versioned, republished, and rolled
  back without changing the provider's base environment.
- [x] Build a flagship multi-table analytics example with joins, aggregation, and a
  deterministic business rule. See [`examples/analytics`](examples/analytics/README.md).
- [ ] Add a visual plan inspector showing query, transformation, renderer, version, and
  invocation history without exposing hidden model reasoning.
- [ ] Add `ROADMAP.md`, release notes, issue templates, PR template, and GitHub
  Discussions onboarding.
- [ ] Clarify the Centrum/`@ai-interfaces/*` naming relationship in all package docs.
- [x] Publish the first working public frontend demo using the hosting plan in
  [`docs/demo-hosting.md`](docs/demo-hosting.md).
- [ ] Deploy the Fastify API and connect the public playground to it.
- [ ] Add a client-facing workflow for creating APIs on demand from natural-language
  requirements, subject to provider-defined capabilities and policies.

## Phase 2 — remove adoption friction (days 31–60)

- [ ] Add a PostgreSQL database adapter while preserving the current read-only policy.
- [ ] Move the hosted reference deployment from local SQLite to managed PostgreSQL.
- [ ] Separate provider environment configuration from client API definitions and
  versions.
- [ ] Add per-client namespaces, quotas, permissions, and audit views.
- [ ] Add database backup, restore, migration, and credential-rotation guidance.
- [ ] Add a generated OpenAPI description and a small Python client for the HTTP API.
- [ ] Add a cost and latency comparison to the flagship demo.
- [ ] Add CodeQL or equivalent static analysis, dependency review, secret scanning,
  SBOM generation, and coverage reporting to CI.
- [ ] Start an OpenSSF Best Practices Badge assessment.
- [ ] Publish two technical walkthroughs and one contributor-focused tutorial.
- [ ] Label a maintained set of `good first issue` and `help wanted` tasks.

## Phase 3 — build external momentum (days 61–90)

- [ ] Release the next version with migration notes and a compatibility matrix.
- [ ] Publish a hosted demo and a short architecture walkthrough video.
- [ ] Present the flagship example to TypeScript, AI engineering, WebAssembly, and
  open-source communities.
- [ ] Recruit at least two external design partners and document their feedback.
- [ ] Add a maintainer path for recurring contributors.
- [ ] Publish one case study with measured provider calls avoided, latency, and cost.

## Later, deliberately not now

- Hosted multi-tenant production service
- Managed database provisioning and billing for customer environments
- Provider-controlled environment policies exposed as unrestricted client authority
- Public unauthenticated persisted APIs
- Arbitrary JavaScript execution
- Model-authored raw SQL or unrestricted database access
- Write/mutation capabilities without approval, idempotency, compensation, and audit
- Broad SDK support before the HTTP contract and TypeScript package boundary stabilize

## Success signals

Track adoption rather than stars alone:

- Time from clone to first successful response
- Weekly demo users and successful persisted API creations
- npm downloads and external repository usage
- Number of external contributors and merged first contributions
- Number of third-party adapters and examples
- Provider calls avoided by persisted invocations
- Open issues receiving a first maintainer response within two business days

This document is intentionally actionable. When new work does not support the north-star
outcome or a phase goal, open a roadmap discussion before adding it to the main path.
