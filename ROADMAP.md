# Centrum roadmap

Centrum turns an LLM request into a governed, editable API that can later run
without an LLM. This roadmap keeps the project focused on proving that promise,
making the repository easy to adopt, and building trust with open-source users.

## North-star outcome

An engineer can describe a data workflow once, inspect the generated query and
logic, persist it as a tenant-owned API, and invoke it repeatedly with predictable
cost, latency, authorization, and audit behavior.

## Current baseline

- Self-hosted TypeScript packages for the governed runtime, catalog, renderers, and
  OpenAI provider.
- Reference Fastify server and React playground.
- JSON-over-HTTP examples for Python, JavaScript, Java, Go, and Rust.
- Versioned persisted APIs with idempotent creation, optimistic updates, publication,
  tenant scoping, and audit history.
- Constrained `wasm-core-v1` transforms that run without host imports in a disposable
  worker.

## Phase 1 — make the promise obvious (next 30 days)

- [ ] Publish a one-command local demo that shows provider calls changing from one to
  zero after API persistence.
- [ ] Build a flagship multi-table analytics example with joins, aggregation, and a
  deterministic business rule.
- [ ] Add a visual plan inspector showing query, transformation, renderer, version, and
  invocation history without exposing hidden model reasoning.
- [ ] Add `ROADMAP.md`, release notes, issue templates, PR template, and GitHub
  Discussions onboarding.
- [ ] Clarify the Centrum/`@ai-interfaces/*` naming relationship in all package docs.
- [ ] Publish the first working public demo using the hosting plan in
  [`docs/demo-hosting.md`](docs/demo-hosting.md).

## Phase 2 — remove adoption friction (days 31–60)

- [ ] Add a PostgreSQL catalog adapter while preserving the current read-only policy.
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

