# Executable API roadmap

Centrum's long-term goal is to let a company expose a governed data environment
while clients use an LLM to build APIs over that environment. The LLM is the
authoring and compilation assistant; published APIs run as versioned executable
artifacts without requiring an LLM on every request.

## Target lifecycle

```text
Describe → Generate → Validate → Preview → Test → Review → Publish → Invoke
```

Each published version must include an API contract, a typed query plan, a bounded
transformation artifact, generated tests, and an audit record. A failed or revoked
version must never become the active route.

## Phased implementation

### Phase 1 — Artifact contract and safe execution (current)

- Define a versioned executable-artifact envelope.
- Persist immutable artifact versions alongside the API manifest.
- Add content hashes and verify artifacts before execution.
- Keep the existing import-free `wasm-core-v1` worker as the only code runtime.
- Keep SQL and tenant scope owned by host capabilities.

### Phase 2 — General query IR

- Add a typed query intermediate representation for multiple tables, joins, unions,
  grouping, aggregates, pagination, and parameter declarations.
- Compile the IR to parameterized SQL through database-specific adapters.
- Reject unbounded scans, unsafe identifiers, cross-tenant access, and unsupported
  operations before an artifact can be published.

### Phase 3 — LLM compiler pipeline

- Add a compiler-only provider contract that returns a manifest, query IR, source code,
  schemas, and tests—not an executable handler.
- Compile supported source languages in an isolated build worker into Wasm.
- Record compiler, source, dependency, and artifact hashes for reproducibility.
- Never give generated code a database connection, credential, filesystem, network, or
  unrestricted host API.

### Phase 4 — Test, approval, and release controls

- Run generated contract, tenant-isolation, limit, and regression tests against fixtures.
- Add draft, staged, published, revoked, and rollback states.
- Require explicit client approval before publishing a generated version.
- Add quotas, timeouts, memory limits, observability, and artifact garbage collection.

### Phase 5 — Production adapters

- Add durable database and object-storage adapters for serverless deployments.
- Provide deployment adapters for long-running Node services and Vercel-style functions.
- Add SDKs and examples for Python, JavaScript, Java, Go, and Rust.

## Non-negotiable boundaries

- Generated code is never executed inside the API process with unrestricted Node.js APIs.
- Raw SQL, credentials, tenant IDs, environment variables, arbitrary URLs, and shell
  access are not model inputs.
- Tenant identity always comes from the authenticated principal.
- Every active artifact is immutable, content-addressed, versioned, and auditable.
- Read-only data access remains the default; writes require a separate approval design.

## Success criterion

A client can describe a data-backed API, inspect the generated query and code, run a
deterministic preview and test suite, publish an immutable version, and serve repeated
requests from the persisted artifact with no model call—while the company retains
authority over data, capabilities, limits, and publication.
