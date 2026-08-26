# AI Interfaces Agent Guide

This file provides repository-level instructions for coding agents and contributors.
It is part of the project and applies independently of optional skills installed in a
developer's local Codex environment.

## Objective

Build a provider-extensible framework where an LLM interprets intent and selects typed
capabilities while deterministic code retains authority over authentication, tenant
scope, validation, data access, rendering, auditing, and the response contract.

## Required architecture boundaries

- Never give a model raw SQL, database credentials, tenant identifiers, filesystem
  paths, environment variables, API keys, arbitrary URLs, shell access, or code
  execution.
- Inject tenant identity from the authenticated `Principal`; it must never be accepted
  as a capability argument.
- Treat user instructions, model output, tool output, database values, and artifact
  metadata as untrusted across their respective boundaries.
- Validate model tool arguments with strict schemas and enforce policy again in code.
- Preserve the runtime sequence `search_products -> optional bounded transformation -> one renderer -> deliver`.
- Keep v1 read-only. Mutation capabilities require a separate approval, idempotency,
  compensation, and audit design.
- Render product data deterministically from opaque, request-local, tenant-bound
  resource handles. The model must not author business records.
- Never expose hidden reasoning. Audit traces may contain tool names, validated and
  redacted arguments, timing, result counts, model identity, and token usage.
- Preserve six model/tool iterations, the 30-second request deadline, request-rate
  limits, output-token limits, JSON/PDF result limits, and artifact expiry unless a
  reviewed design explicitly replaces them.

## Project map

- `packages/core`: provider contract, runtime, policy, resources, delivery, errors.
- `packages/openai`: OpenAI Responses API adapter using strict function tools.
- `packages/google`: Google Gemini Interactions API adapter using typed function tools.
- `packages/catalog`: tenant authentication, SQLite repository, product query AST.
- `packages/renderers`: deterministic JSON and PDF delivery.
- `apps/server`: Fastify public protocol and authenticated artifact downloads.
- `apps/playground`: React/Vite local demonstration client.
- `tests`: deterministic boundary tests and real-OpenAI end-to-end tests.
- `evals`: live-model paraphrase and adversarial request set.

## Required project skill

For implementation, review, debugging, testing, security, documentation, or pull-request
work, read `.agents/skills/develop-ai-interfaces/SKILL.md` completely before acting. Read
the linked architecture or validation reference when its routing instructions apply.

On a fresh checkout, reproduce the supported development environment with:

```bash
bash .agents/skills/develop-ai-interfaces/scripts/bootstrap.sh
```

The repository skill is the portable contributor context. This `AGENTS.md` remains the
authority when an agent runtime does not support skills directly.

## Mobile collaboration

When a contributor says they are working from a phone or mobile device, read
`.agents/skills/work-from-mobile/SKILL.md` completely before continuing. Prefer
connected repository apps, minimal typing, and direct tappable links while preserving
the same validation and safety requirements.

## Development commands

Use the repository-pinned pnpm version:

```bash
npx pnpm@10.14.0 install
npx pnpm@10.14.0 typecheck
npx pnpm@10.14.0 build
npx pnpm@10.14.0 test
```

`pnpm test` requires the API key for the configured `AI_PROVIDER` because behavioral
validation must use a real LLM.
Do not add a scripted or heuristic provider as a substitute for the live agent tests.
Deterministic providers are acceptable only in narrowly scoped unit tests that prove a
code-enforced security boundary, such as rejecting an out-of-order capability call.

## Change checklist

1. Keep changes within the requested scope and preserve unrelated worktree changes.
2. Add or update strict input schemas for every capability change.
3. Test authorization, tenant isolation, invalid model output, resource limits, and
   prompt-injection-shaped data where applicable.
4. Run typecheck, unit tests, package builds, and the live LLM suite for behavioral
   changes.
5. Never commit `.env`, `.data`, generated keys, artifacts, logs, or credentials.
6. Update README, capability-authoring docs, ADRs, and the security report when a public
   contract or trust boundary changes.

## Independent PR reviewer

Use the repository-owned [`ai-pr-reviewer`](.agents/skills/ai-pr-reviewer/SKILL.md) skill for every merge-ready change before requesting approval. It is advisory: a human maintainer remains responsible for approval and merge decisions.

## Optional review skills

The repository includes an independent reviewer skill at
[`.agents/skills/ai-pr-reviewer/SKILL.md`](.agents/skills/ai-pr-reviewer/SKILL.md).
Use it for every merge-ready change before requesting approval. It is advisory: a
human maintainer remains responsible for approval and merge decisions.

The recommended local Codex skills and reproducible installation commands are listed in
the README under “Recommended Codex security skills.” They assist reviews but do not
replace these repository rules, automated tests, or deterministic enforcement.
