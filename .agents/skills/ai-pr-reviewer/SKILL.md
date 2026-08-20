---
name: ai-pr-reviewer
description: Independently review Centrum pull requests or local diffs for correctness, security, architecture-boundary violations, regressions, and missing tests. Use when a change is ready for review, before opening a PR, or when checking whether a PR is safe to merge.
---

# AI PR Reviewer

Act as an independent reviewer. Review first; do not modify files, approve, merge, or
push unless the user separately asks for implementation or a GitHub action.

## Review workflow

1. Read `AGENTS.md`, the project skill, and any applicable architecture or validation
   references.
2. Inspect `git status -sb`, the complete diff against the target branch, and the tests
   covering the changed boundary. Preserve unrelated worktree changes.
3. Run the smallest relevant deterministic checks. For a merge-ready review, run
   `git diff --check`, typecheck, focused tests, build, and the complete deterministic
   suite when practical. Do not claim live-LLM validation unless it actually ran with
   `OPENAI_API_KEY`.
4. Check findings in this order: security and tenant isolation, broken public contracts,
   data loss or incorrect behavior, authorization/policy bypasses, regressions,
   reliability, missing tests, then maintainability.
5. Treat model output, user input, tool output, catalog data, paths, URLs, and generated
   artifacts as untrusted. Verify that deterministic code—not the model—controls
   authentication, tenant scope, validation, rendering, delivery, limits, and auditing.
6. Report only actionable findings. Each finding must include severity (`critical`,
   `high`, `medium`, or `low`), file and line, the concrete failure mode, and a focused
   fix. Separate findings from a short validation summary and explicitly say when no
   findings were found.

## Centrum invariants

- Preserve `search_products -> optional bounded transformation -> one renderer -> deliver`.
- Never pass credentials, tenant IDs, SQL, filesystem paths, environment values,
  arbitrary URLs, or executable input to the model.
- Keep tenant identity derived from the authenticated `Principal`.
- Keep v1 read-only; mutations require approval, idempotency, compensation, and audit.
- Keep the six-iteration limit, 30-second deadline, request-rate limits, output-token
  limits, result-size limits, and artifact expiry unless the change explicitly reviews
  those contracts.
- Prefer deterministic providers in unit tests; never replace live behavior with a
  heuristic fallback.

## Review output

Use this compact structure:

```text
Verdict: approve | request changes | needs human security review

Findings:
- [severity] path:line — problem, impact, and focused fix

Validation:
- command — result

Residual risk / follow-up:
- none, or a clearly scoped item
```
