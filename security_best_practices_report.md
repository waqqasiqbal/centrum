# AI Interfaces Security Review

Date: 2026-08-16
Scope: TypeScript monorepo, Fastify API, OpenAI Responses adapter, SQLite catalog,
persisted APIs, PDF artifacts, React/Vite playground, tests, and GitHub Actions.

## Executive summary

The review found no critical vulnerability and no known vulnerable production
dependency. Seven application findings were fixed. The most important changes bound
LLM cost, made tool order a code-enforced state machine, removed predictable signing
secrets, made demo-key exposure opt-in, constrained artifact paths and retention, and
added browser/API hardening.

The architecture has a strong base: the model cannot submit tenant IDs or SQL, tool
arguments are schema validated, tenant scope is injected in the repository query,
resource handles are request-local and tenant-bound, product values never become model
instructions, and model-facing v1 exposes no mutation, network-fetch, shell, or arbitrary
filesystem capability. Persisted API management is isolated as an authenticated,
bounded, versioned, idempotent, and audited server operation.

Residual production work remains: rate limits and token/cost budgets must move to a
shared durable store, deployment headers must be verified at the edge, OpenAI data
retention must be configured to the project's privacy requirements, and the live LLM
adversarial/evaluation suite must run with a real project key.

## Threat model

- Adversaries: unauthenticated clients, compromised tenant keys, malicious tenants,
  prompt-injection text in instructions or product data, and a provider returning an
  invalid tool call.
- Protected assets: tenant catalog data, persisted plans, previews and version history, API
  keys, cursor integrity, generated PDF artifacts, filesystem paths, model budget,
  audit integrity, and system configuration.
- Trust boundaries: HTTP client to Fastify; Fastify to authenticated principal; runtime
  to model provider; model output to capability schemas; capability to SQLite/filesystem;
  API response to browser.
- Out of scope for v1: model-facing write capabilities, cross-service identity,
  asynchronous jobs, anonymous persisted routes, and production infrastructure controls.

## Findings and remediation

### AIIF-SEC-001 — High — Unbounded model consumption — Fixed

- Rule: OWASP LLM10 / API4 Unrestricted Resource Consumption.
- Location: `apps/server/src/app.ts:83-84,115-123`; `packages/openai/src/index.ts:38-47`.
- Evidence before fix: requests had a 30-second/six-turn bound, but no request-rate or
  output-token limit.
- Impact: a valid or automated key could create denial-of-wallet and service degradation.
- Fix: 16 KiB body limit, IP and principal fixed-window limits, stable `RATE_LIMITED`
  failures, and `max_output_tokens: 1200`. The existing six-turn/30-second bounds remain.
- Residual mitigation: use Redis/gateway limits, concurrent-request caps, and durable
  per-tenant token/currency budgets in production.

### AIIF-SEC-002 — High — Prompt/provider could skip capability order — Fixed

- Rule: OWASP LLM01 Prompt Injection and LLM06 Excessive Agency.
- Location: `packages/core/src/runtime.ts:52-76,93-117,144-200`.
- Evidence before fix: all authorized tools were presented every turn and the runtime
  did not independently enforce `search -> renderer -> deliver`.
- Impact: a compromised or confused provider could attempt an out-of-order or multi-tool
  action, relying on handle failures as the only containment.
- Fix: the runtime now exposes only phase-appropriate tools, accepts exactly one call per
  model turn, and deterministically denies out-of-sequence calls. A malicious-provider
  regression test verifies the boundary.
- Mitigation: keep resource-handle type and tenant checks even with the state machine.

### AIIF-SEC-003 — High — Predictable cursor secret and implicit demo-key exposure — Fixed

- Rule: OWASP API2 Broken Authentication / secret-management guidance.
- Location: `apps/server/src/app.ts:64-71,110-113,208-231`.
- Evidence before fix: cursor HMACs defaulted to the known string
  `local-development-secret`; demo keys were exposed whenever `NODE_ENV` was not exactly
  `production`.
- Impact: a known signing key could permit forged pagination state; a production-like
  deployment with a missing mode flag could disclose plaintext demo credentials.
- Fix: production fails closed without a 32-byte secret; local runs generate an
  unpredictable ephemeral secret; demo discovery requires explicit
  `AI_ENABLE_DEMO_KEYS=true` and remains forbidden in production; CORS uses exact
  configured origins in production.
- Mitigation: provision the signing value from a secret manager and rotate it with a
  versioned-key strategy before public deployment.

### AIIF-SEC-004 — Medium — Artifact path and retention hardening — Fixed

- Rule: OWASP API1 BOLA, path traversal, and sensitive-data lifecycle guidance.
- Location: `apps/server/src/app.ts:160-182`; `packages/catalog/src/database.ts:122-140`;
  `packages/renderers/src/index.ts:112-116`.
- Evidence before fix: tenant and expiry checks existed, but a stored path was opened
  without verifying it remained inside the artifact root, and expired files stayed on
  disk.
- Impact: database corruption or a future unsafe write path could turn the download
  endpoint into a local file read; expired tenant exports retained sensitive data.
- Fix: strict artifact-ID format, tenant query, canonical path containment, private
  directory/file permissions, and deletion of both expired file and metadata on access.
- Residual mitigation: production should use tenant-scoped object storage with lifecycle
  rules and periodic cleanup for never-accessed expired files.

### AIIF-SEC-005 — Medium — Missing HTTP/browser hardening — Fixed

- Rule: OWASP API8 Security Misconfiguration and React/JavaScript security baseline.
- Location: `apps/server/src/app.ts:83-102`; `apps/playground/index.html:4-6`.
- Evidence before fix: API responses lacked explicit security headers and the playground
  loaded fonts from a third-party origin.
- Impact: weaker defense in depth for MIME confusion, clickjacking, referrer leakage,
  injection, and unnecessary third-party supply-chain/privacy exposure.
- Fix: CSP, nosniff, frame denial, referrer and permissions policies, same-origin resource
  policy, no-store caching, a static-app CSP, and system fonts with no remote stylesheet.
- Residual mitigation: deliver the playground CSP as an HTTP header at the hosting edge;
  meta CSP cannot enforce `frame-ancestors`.

### AIIF-SEC-006 — Medium — Mutable CI action references — Fixed

- Rule: CI/CD supply-chain integrity.
- Location: `.github/workflows/ci.yml:15-25,35-44`.
- Evidence before fix: workflow actions used mutable major-version tags.
- Impact: a compromised or retargeted action tag could execute in CI.
- Fix: checkout, Node setup, and pnpm setup actions are pinned to full commit SHAs; CI
  retains read-only repository permissions and frozen-lockfile installation.
- Mitigation: use automated reviewed updates for pinned SHAs and generate an SBOM for
  releases.

### AIIF-SEC-007 — Low — Client trusted artifact download URL — Fixed

- Rule: secure LLM output handling / untrusted URL handling.
- Location: `apps/playground/src/App.tsx:94-104`.
- Evidence before fix: the browser fetched `artifact.downloadUrl` directly from the API
  envelope while attaching the tenant key.
- Impact: if the envelope were compromised in a future provider or proxy change, a
  cross-origin URL could receive a credential-bearing request.
- Fix: downloads must resolve to the current origin and `/v1/artifacts/` path before the
  credential is attached.

## Verified controls

- BOLA/tenant isolation: API key authentication resolves tenant server-side; SQL always
  starts with `tenant_id = ?`; artifact reads require both artifact ID and tenant ID.
- SQL injection: sort fields, operators, projections, and columns are allowlisted; values
  are bound parameters. No model-generated SQL is accepted.
- Prompt injection: product records are retained in request-local resources and rendered
  deterministically; raw rows are not sent back to the model.
- Output handling: React uses escaped JSX; no `dangerouslySetInnerHTML`, `innerHTML`,
  `eval`, shell, arbitrary URL fetch, or arbitrary file capability was found. Persisted
  artifacts use a bounded `json-pipeline-v1` transformation with allowlisted `pick` and
  `rename` operations; they do not execute model-authored code or raw SQL.
- Secrets: no credential pattern was found in tracked source; `.env` and `.data` are
  ignored; generated demo keys are high entropy, hashed at rest, and written mode 0600.
- Audit privacy: traces contain tool names/validated arguments/usage, not hidden model
  reasoning or product-record content.
- Persisted API mutations: management and invocation use separate key authorities;
  tenant scope is injected; creation keys are hashed and request-bound; updates require
  the current version; each mutation creates immutable plan/version and audit rows;
  plans and previews are JSON-only and limited to 64 KiB.

## Dependency and verification results

- `pnpm audit`: 0 critical, 0 high, 0 moderate; one low dev-only advisory in `esbuild
  0.27.7` affecting the Windows development server through `tsup`. It does not affect
  production runtime. Upgrade when the build chain supports `esbuild >=0.28.1`.
- Supply-chain policy: installation correctly rejected seven dependencies published
  within the configured 24-hour minimum-release-age window. The policy was not weakened.
- TypeScript: passed.
- Unit/security tests: 20 passed.
- Package builds: core, catalog, renderers, and OpenAI adapter passed.
- Playground production build: passed.
- Secret-pattern scan: no match.
- Live OpenAI tests: not run because `OPENAI_API_KEY` is absent. This is a release gate,
  not replaced by a scripted provider.

## Release gates

1. Run `pnpm test:llm` and the 30-prompt eval set with the intended OpenAI project/model.
2. Add shared rate limiting, concurrency limits, daily token/cost budgets, and alerts.
3. Decide and document OpenAI storage/retention settings based on privacy requirements.
4. Configure managed secrets and durable tenant-scoped artifact storage with lifecycle
   deletion.
5. Verify CORS, CSP, TLS/HSTS, request limits, logs, and source-map exposure against the
   deployed origin—not only repository configuration.
