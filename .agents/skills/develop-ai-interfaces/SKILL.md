---
name: develop-ai-interfaces
description: Develop, review, test, or document the AI Interfaces TypeScript monorepo, including its governed runtime, provider adapters, catalog capability, renderers, Fastify server, React playground, security boundaries, and deterministic or live tests. Use for implementation, debugging, test creation, architecture changes, security reviews, contributor setup, and pull-request preparation in the `centrum`/`ai-interfaces` repository.
---

# Develop AI Interfaces

Preserve the repository's deterministic authority boundaries while making small,
testable changes. Treat the model as an untrusted planner, never as the authority for
authentication, tenant scope, data access, rendering, delivery, or policy.

## Orient

1. Confirm the repository by checking `package.json` for `ai-interfaces`.
2. Read the repository's `AGENTS.md` completely before editing.
3. Inspect `git status -sb` and preserve unrelated changes.
4. Read [references/architecture.md](references/architecture.md) when changing runtime,
   capabilities, providers, catalog access, renderers, server routes, or security policy.
5. Read [references/validation.md](references/validation.md) before selecting checks or
   changing tests, build scripts, dependencies, or contributor setup.

## Set up

Run the bundled bootstrap from the repository root or pass the checkout path:

```bash
bash .agents/skills/develop-ai-interfaces/scripts/bootstrap.sh [repository-path]
```

The script verifies Node.js, installs pinned pnpm dependencies, builds packages,
type-checks, and runs deterministic tests. It never runs the live OpenAI suite unless
called with `--live` and an API key is already configured.

Do not create, request, display, or commit API keys. Never add `.env`, `.data`, generated
artifacts, logs, or demo credentials to source control.

## Implement

1. Identify the package that owns the behavior; avoid cross-package shortcuts.
2. Keep tenant identity injected from the authenticated `Principal`.
3. Keep model-facing arguments strict, bounded, and free of tenant IDs, credentials,
   SQL, paths, environment values, arbitrary URLs, or executable input.
4. Preserve `search_products -> one renderer -> deliver` unless a reviewed design
   explicitly changes the protocol.
5. Keep product data and file generation deterministic. Exchange request-local,
   tenant-bound opaque handles between capabilities.
6. Keep v1 read-only. Do not introduce mutation tools without a separate approval,
   idempotency, compensation, and audit design.
7. Add focused tests at the boundary being changed. Prefer deterministic providers in
   unit tests only; do not add a heuristic runtime fallback.
8. Update architecture, security, and capability documentation when a public contract or
   trust boundary changes.

## Validate

Run the smallest relevant checks while iterating, then run the complete deterministic
matrix from [references/validation.md](references/validation.md). Run live tests only
when the change affects model behavior and `OPENAI_API_KEY` is configured.

Report exactly which checks ran, their results, and any suite skipped with its reason.
Never claim live-model validation from deterministic test doubles.

## Publish

Before committing or opening a pull request:

1. Run `git diff --check` and inspect the complete diff.
2. Confirm only intended files are staged.
3. Use a focused branch and concise commit message.
4. Describe the changed boundary, user/developer impact, and exact validation in the PR.
5. Default to a draft PR unless the user explicitly asks for ready-for-review.
