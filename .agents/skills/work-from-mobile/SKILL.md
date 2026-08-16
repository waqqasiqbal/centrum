---
name: work-from-mobile
description: Complete coding, repository, CI, and pull-request tasks with a mobile-first interaction style. Use when the user says they are on a phone or mobile device, asks for tappable links or minimal typing, cannot use a terminal conveniently, or has established that the current work session is mobile. Prefer connected apps for remote actions and carry authorized work through validation and PR creation without repeatedly asking the user to operate desktop tooling.
---

# Work from Mobile

Minimize user effort without weakening safety, validation, or repository rules.

## Operate mobile-first

1. Keep updates short and make the next action obvious.
2. Prefer connected apps and repository plugins for branches, file commits, pull
   requests, comments, reviews, merges, and CI inspection.
3. Do not ask the user to run terminal commands when an available connected app can
   perform the same action safely.
4. Complete the authorized workflow end to end. Do not repeatedly ask for permission
   for ordinary, reversible steps already implied by requests such as “fix and give me
   the PR.”
5. Ask only for decisions that materially change scope, risk, cost, or irreversible
   effects. Make questions answerable with a short reply such as “yes” or “option 1.”
6. Provide direct tappable links to PRs, checks, issues, artifacts, and authorization
   pages. Avoid local file links unless the user specifically needs the file.

## Handle GitHub work

- Read repository instructions and use any applicable project skill before editing.
- Use local tools for implementation and validation when available, then use the
  connected GitHub app to publish when it exposes the required branch, file, commit,
  and PR operations.
- Fall back to GitHub CLI only for capabilities the connected app does not provide.
  If authentication is necessary, start a secure device flow and give the user the
  tappable URL plus one-time code. Never request passwords or access tokens in chat.
- Open a regular ready-for-review PR when work is complete and relevant checks pass.
  Use a draft only for intentionally incomplete work, early design feedback, or when
  the user requests one.
- State the exact files changed, validation performed, skipped checks with reasons,
  and any remaining risk in the PR description.
- After publishing, return the PR link first. Do not make the user search GitHub.

## Reduce notification noise

- Batch coherent edits into focused commits instead of publishing every intermediate
  attempt.
- Validate locally before publishing whenever practical.
- When repairing CI, inspect real failure logs, address the observed cause, and avoid
  rerunning credential-dependent or flaky external checks unnecessarily.

## Preserve safety

- Do not bypass confirmations required for destructive, irreversible, privileged, or
  externally visible actions outside the approved scope.
- Never expose secrets, authentication codes after they expire, hidden reasoning, or
  sensitive logs.
- Treat mobile access as an interaction constraint, not permission to reduce test or
  review quality.
