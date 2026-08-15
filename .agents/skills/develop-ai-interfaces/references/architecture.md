# Architecture reference

## Runtime contract

The public execution path is:

1. Authenticate the API key and construct `Principal`.
2. Apply preflight policy.
3. Expose only phase-appropriate capabilities to the provider.
4. Execute exactly one validated capability call per model turn.
5. Preserve `search_products -> one renderer -> deliver`.
6. Return a versioned delivery envelope and bounded audit trace.

The default limits are six model/tool iterations, a 30-second request deadline, 1,200
provider output tokens per turn, 100 JSON rows per page, 1,000 PDF rows, and one-hour
artifact expiry.

## Trust boundaries

- Resolve `tenantId` from `Principal`; never accept it as a tool argument.
- Treat user instructions, model output, tool output, database values, and artifact
  metadata as untrusted at their respective boundaries.
- Validate model arguments with strict schemas and recheck policy in deterministic code.
- Build SQL only from allowlisted fields/operators and bound values.
- Bind resource handles and artifacts to the authenticated tenant.
- Keep traces limited to tool names, validated/redacted arguments, timing, counts, model
  identity, and token usage. Never expose hidden reasoning.
- Keep the model away from credentials, raw SQL, paths, environment variables, arbitrary
  URLs, shell access, and code execution.

## Package ownership

| Path | Responsibility |
| --- | --- |
| `packages/core` | Runtime state machine, types, policy, resources, delivery, errors |
| `packages/openai` | OpenAI Responses API adapter and strict function tools |
| `packages/catalog` | Authentication, SQLite repository, product query AST and cursors |
| `packages/renderers` | Deterministic JSON and PDF preparation |
| `apps/server` | Fastify protocol, rate limits, CORS, artifact downloads |
| `apps/playground` | React/Vite local client |
| `tests` | Deterministic boundary tests and live OpenAI behavior tests |
| `evals` | Representative and adversarial live-model requests |

Read the repository ADRs and `docs/capability-authoring.md` before changing capability
semantics, authority, mutation policy, or resource handles.

