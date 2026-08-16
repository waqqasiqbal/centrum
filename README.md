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

## Setup

### Prerequisites

- Node.js 22 or newer
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

Run the deterministic contributor matrix without an API key:

```bash
npx pnpm@10.14.0 build:packages
npx pnpm@10.14.0 typecheck
npx pnpm@10.14.0 test:unit
npx pnpm@10.14.0 --filter @ai-interfaces/playground build
```

The latest local verification completed successfully: type checking, all package and
playground builds, and all 17 deterministic policy, runtime, catalog, and security tests
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
