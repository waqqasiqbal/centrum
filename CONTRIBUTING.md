# Contributing

AI Interfaces is exploring a narrow proposition: natural-language flexibility can
coexist with deterministic authority and canonical output.

## Development

1. Install Node.js 22 or newer.
2. Run `npx pnpm@10.14.0 install`.
3. Run `npx pnpm@10.14.0 demo:seed`.
4. Make focused changes with tests.
5. Run `npx pnpm@10.14.0 typecheck`, `test`, and `build`.

New capabilities must define a strict input schema, validate every model-controlled
value, receive tenant identity from runtime context, return opaque handles when they
produce reusable data, and include adversarial tests. Do not add unrestricted SQL,
shell, filesystem, network, or code-execution capabilities.

Provider changes must preserve the `AgentProvider` contract and pass the live LLM
integration suite. The default test command requires `OPENAI_API_KEY`; a scripted
provider is not an acceptable substitute for agent behavior.

By submitting a contribution, you agree that it is licensed under Apache 2.0.
