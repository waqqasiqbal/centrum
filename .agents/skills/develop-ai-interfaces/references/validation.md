# Validation reference

## Environment

- Node.js 22 or newer is required for `node:sqlite`.
- Use the repository-pinned `pnpm@10.14.0`.
- Deterministic checks must not require `OPENAI_API_KEY`.
- The live suite must fail clearly when the key is absent; do not silently skip it.

## Complete deterministic matrix

Run from the repository root:

```bash
npx pnpm@10.14.0 install --frozen-lockfile
npx pnpm@10.14.0 build:packages
npx pnpm@10.14.0 typecheck
npx pnpm@10.14.0 test:unit
npx pnpm@10.14.0 --filter @ai-interfaces/playground build
```

Run the live suite only when model behavior changed and credentials are configured:

```bash
test -n "${OPENAI_API_KEY:-}" && npx pnpm@10.14.0 test:llm
```

## Test placement

| Change | Required focused coverage |
| --- | --- |
| Runtime sequencing | Phase exposure, call count/order, schema failure, authorization |
| Catalog query/cursor | Tenant isolation, allowed filters, pagination stability, limits |
| Provider adapter | Strict tools, output parsing, token limit, abort signal |
| Renderer | Handle type/tenant checks, row limits, deterministic output |
| Server/API | Authentication, body validation, headers, rate limits, artifact isolation |
| Policy | Allowed reads, denied mutations/infrastructure, unsupported outputs |
| Model interpretation | Live OpenAI test and relevant `evals` requests |

Use deterministic providers only to prove code-enforced boundaries. Do not replace live
behavioral validation with scripted keyword logic.

