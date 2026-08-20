# AI Interfaces

AI Interfaces is an experimental TypeScript framework for governed agentic APIs.
Clients describe an outcome in natural language; a model selects typed capabilities;
deterministic application code enforces authority, reads canonical data, renders the
result, and returns a versioned response envelope.

The reference prototype supports tenant-scoped product queries as JSON or PDF.


## The motivation behind Centrum

Most APIs are static: they expose fixed endpoints, accept predefined inputs, and return predefined outputs. Centrum is built around a different vision—APIs that can become smarter over time.

A client should be able to use an LLM initially to describe the response or behavior it needs. Centrum can then help turn that requirement into a reusable, persistent API. Instead of paying the cost of an LLM for every request, the client can run the persisted version, modify it as requirements change, and gradually shape the API around its own domain and workflow.

This creates two complementary paths: direct intelligence through an LLM, and efficient, customizable behavior through persisted APIs. The goal is not to replace conventional APIs, but to give them a layer of understanding, adaptability, and evolution.

Today, Centrum explores this model through governed LLM interactions and reusable API behavior. Tomorrow, as locally deployed models become faster, smaller, and more capable, requests may be served intelligently by models running close to the application and its data.

The long-term ambition is to build APIs that do more than respond: APIs that understand context, adapt to client requirements, and can be refined over time—APIs with a brain.

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

## Setup

### Install the framework library

The first release is a self-hosted TypeScript library. Install the reusable packages
inside your own Node.js 24+ application:

```bash
npm install @ai-interfaces/core @ai-interfaces/openai \
  @ai-interfaces/catalog @ai-interfaces/renderers
```

The packages are designed to be composed in application code. The reference Fastify
server and React playground in this repository are examples, not required runtime
dependencies. See [Library installation and release](docs/library-release.md) for a
minimal application example and the package/release boundary.

### Prerequisites

- Node.js 24 LTS or newer
- Git
- An OpenAI API key with access to the configured model

Clone and install the pinned pnpm version:

```bash
git clone https://github.com/waqqasiqbal/centrum.git
cd centrum
npx pnpm@10.14.0 install
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env` before starting the server or running live-model tests.
For local playground key discovery, leave `AI_ENABLE_DEMO_KEYS=true`. The checked-in
example contains no credentials. Never commit `.env` or anything under `.data/`.

Seed two isolated demo tenants and start the API and playground:

```bash
npx pnpm@10.14.0 demo:seed
npx pnpm@10.14.0 dev
```

Open [http://localhost:5173](http://localhost:5173). The playground discovers the
two local development tenants created by the seed command.

The prototype always uses a real LLM through the OpenAI Responses API. It intentionally
has no scripted or non-LLM runtime fallback. The default model is `gpt-5.6-terra` with
medium reasoning; override it with `OPENAI_MODEL`.

### Contributor agent setup

The repository includes a portable project skill at
[`develop-ai-interfaces`](.agents/skills/develop-ai-interfaces/SKILL.md). It gives coding
agents the architecture boundaries, package ownership, test-selection rules, and
reproducible environment workflow needed to contribute safely.

Agents must read [AGENTS.md](AGENTS.md), which routes project work to the skill and
remains authoritative for runtimes that do not discover repository skills automatically.
Bootstrap a fresh checkout with:

```bash
bash .agents/skills/develop-ai-interfaces/scripts/bootstrap.sh
```

Pass `--live` only when `OPENAI_API_KEY` is already configured and the change requires
real-model behavioral validation.


For an independent pre-merge review, use the repository-owned [`ai-pr-reviewer`](.agents/skills/ai-pr-reviewer/SKILL.md) skill. It runs locally from the checkout and does not require a GitHub or OpenAI API key; a human maintainer retains approval and merge responsibility.

### Recommended Codex security skills

The framework does not require agent skills at runtime. They are optional development
tools used by Codex contributors for secure implementation and review. Skills are
installed in each contributor's Codex home. Unlike the repository-owned project skill,
these optional third-party review skills are not copied into this repository.

This project was reviewed with the following skills:

| Skill | Source | Purpose |
| --- | --- | --- |
| `security-best-practices` | [`openai/skills`](https://github.com/openai/skills/tree/main/skills/.curated/security-best-practices) | TypeScript, React, and web-security baseline |
| `code-security` | [`semgrep/skills`](https://github.com/semgrep/skills/tree/main/skills/code-security) | Secure coding and injection review |
| `llm-security` | [`semgrep/skills`](https://github.com/semgrep/skills/tree/main/skills/llm-security) | OWASP LLM risks, agency, and output handling |
| `api-security-review` | [`OWASP/secure-agent-playbook`](https://github.com/OWASP/secure-agent-playbook/tree/main/plugins/code-security-skills/skills/api-security-review) | OWASP API Security Top 10 review |

Codex includes a system skill installer. Install the same reviewed skill set with:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo openai/skills \
  --path skills/.curated/security-best-practices

python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo semgrep/skills \
  --path skills/code-security skills/llm-security

python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo OWASP/secure-agent-playbook \
  --path plugins/code-security-skills/skills/api-security-review
```

The installer refuses to overwrite an existing skill directory. Existing installations
can be verified with:

```bash
for skill in security-best-practices code-security llm-security api-security-review; do
  test -f "${CODEX_HOME:-$HOME/.codex}/skills/$skill/SKILL.md" && echo "$skill: installed"
done
```

Restart Codex after first-time installation. The repository-level [AGENTS.md](AGENTS.md)
contains the project rules that apply even when optional third-party skills are absent.
The completed review is recorded in
[security_best_practices_report.md](security_best_practices_report.md).

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

## Persist an API response

Interactive requests use an LLM on every execution. When a response should remain
stable, build a tenant-owned persisted API once and invoke it later without a model
call:

```bash
curl http://localhost:3000/v1/persisted-apis \
  -X POST \
  -H 'content-type: application/json' \
  -H 'x-ai-interface-key: YOUR_LOCAL_DEMO_KEY' \
  -H 'idempotency-key: featured-products-v1' \
  -d '{
    "slug": "featured-products",
    "instruction": "Return active outdoor products under €150 as JSON"
  }'

curl http://localhost:3000/v1/persisted/featured-products \
  -H 'x-ai-interface-key: YOUR_LOCAL_DEMO_KEY'
```

Creation uses the governed LLM path once. Invocation and versioned manual edits are
deterministic and make no provider call. Responses remain authenticated, tenant-scoped,
explicitly published, size-limited, versioned, and audited. See the
[persisted API builder guide](docs/persisted-api-builder.md) for management endpoints,
idempotency, editing, publication, and current limitations.

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
- Model-facing v1 capabilities remain read-only; persisted API management is a separate,
  authenticated, versioned, idempotent, and audited server operation.
- Artifact metadata and downloads are tenant-scoped and expire after one hour.
- Tool traces expose bounded audit data, never chain-of-thought.

The demo endpoint exposing local keys requires `AI_ENABLE_DEMO_KEYS=true` and is always
disabled when `NODE_ENV=production`. Production also requires a 32-byte-or-longer
`AI_CURSOR_SECRET`; without one the server fails closed.
See [SECURITY.md](SECURITY.md) before adapting this prototype for production.

## Verification

Run the deterministic contributor matrix without an API key:

```bash
npx pnpm@10.14.0 build:packages
npx pnpm@10.14.0 typecheck
npx pnpm@10.14.0 test:unit
npx pnpm@10.14.0 --filter @ai-interfaces/playground build
```

The latest local verification completed successfully: type checking, all package and
playground builds, and all 20 deterministic policy, runtime, catalog, persisted API,
and security tests
passed.

When model behavior changes, set `OPENAI_API_KEY` and run `npx pnpm@10.14.0 test:llm`.
The live suite fails clearly when the key is absent. `evals/product-requests.json`
contains 30 representative and adversarial requests for broader live-model evaluation.

For work that does not change agent behavior, run the package build before the focused
unit suite:

```bash
npx pnpm@10.14.0 build:packages
npx pnpm@10.14.0 test:unit
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for capability-authoring expectations and
[SECURITY.md](SECURITY.md) for vulnerability reporting and production caveats.

## Community

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Use [SUPPORT.md](SUPPORT.md) for help and sanitized reproduction guidance.
- Review [GOVERNANCE.md](GOVERNANCE.md) for decision-making and maintainer roles.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Status

This is a `0.1.0` research prototype. Writes with approval, persistent sessions,
background jobs, more renderers, PostgreSQL, and additional providers are intentionally
outside v1.

Licensed under Apache 2.0.
