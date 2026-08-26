# ADR 0004: Executable API artifacts

Status: Proposed

## Context

Persisted APIs currently store a validated JSON search plan and optional bounded
transformation. That proves the no-LLM invocation path, but it does not yet let a
client build a genuinely custom data-backed API with reusable business logic.

Allowing generated JavaScript or Node.js handlers to run in the server would make the
LLM an authority over credentials, filesystem access, network access, and process
integrity. The next design must preserve the company's control of its environment.

## Decision

Evolve persisted APIs into immutable executable artifacts with three host-controlled
parts: a typed query IR, a bounded code artifact, and an API contract. The query IR is
compiled to parameterized SQL by a host adapter. Code is compiled outside the API
process and executes in an import-free, resource-limited WebAssembly worker. Artifact
bytes are content-addressed and verified before execution.

The LLM may author the manifest, query IR, source, schemas, and tests. It may not
choose credentials, tenant scope, raw connections, unrestricted SQL, host imports, or
publication state. A client explicitly reviews and publishes a generated version.

## Consequences

Clients gain custom, repeatable APIs whose logic runs without an LLM request. Companies
retain deterministic authorization and data authority. The system needs a compiler
service, query-IR validator, fixture runner, artifact registry, and approval workflow;
these are implemented incrementally in the roadmap.
