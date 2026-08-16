# Multilingual access strategy

AI Interfaces currently runs as a TypeScript service, but consumers do not need to use
TypeScript. The public integration boundary is the versioned HTTP/JSON API. A separate,
more tightly controlled protocol would be required for implementing capabilities in
other languages.

This distinction keeps planning, policy enforcement, tenant isolation, resource
handling, and delivery under one authoritative runtime instead of duplicating security
logic across multiple language implementations.

## Calling AI Interfaces from any language

The reference server currently exposes:

- `POST /v1/execute`
- `GET /v1/artifacts/:artifactId`
- `GET /health`

Requests authenticate with `X-AI-Interface-Key`. The server resolves that key to a
principal before invoking the model; clients must not send or select a `tenantId`.

Any HTTP-capable language can use these endpoints directly. The intended long-term
developer experience is a stable OpenAPI contract plus thin generated SDKs for
TypeScript/JavaScript, Python, Java, Go, Rust, and other ecosystems.

[OpenAPI](https://spec.openapis.org/oas/latest.html) is a language-neutral description
format for HTTP APIs. Tools such as
[OpenAPI Generator](https://github.com/OpenAPITools/openapi-generator) can generate
clients for all of the initial target languages.

### SDK responsibilities

Language SDKs should provide convenience, not reimplement runtime policy:

- configure the base URL, API key, timeout, and cancellation;
- call `execute` with an instruction, context, options, or continuation token;
- parse the versioned data and artifact response variants;
- preserve opaque pagination tokens without decoding or modifying them;
- download artifacts through the authenticated artifact endpoint;
- expose bounded warnings, request IDs, and structured errors;
- provide idiomatic synchronous or asynchronous APIs where appropriate.

SDKs must not duplicate capability selection, authorization, tenant filtering,
rendering policy, or resource-handle logic. Those decisions remain server-side.

### Illustrative usage

These examples describe the target SDK shape; the packages have not been published yet.

Python:

```python
from centrum import Centrum

client = Centrum(
    base_url="https://centrum.example.com",
    api_key="...",
)

result = client.execute("Create a PDF catalog of outdoor products")

if result.kind == "artifact":
    result.download("./catalog.pdf")
```

TypeScript:

```ts
import { Centrum } from "@centrum/client";

const client = new Centrum({
  baseUrl: "https://centrum.example.com",
  apiKey: process.env.CENTRUM_API_KEY!,
});

const result = await client.execute(
  "Create a PDF catalog of outdoor products",
);
```

Java:

```java
var client = CentrumClient.builder()
    .baseUrl("https://centrum.example.com")
    .apiKey(System.getenv("CENTRUM_API_KEY"))
    .build();

var result = client.execute(
    new ExecuteRequest("Create a PDF catalog of outdoor products")
);
```

Go:

```go
client := centrum.NewClient(
    "https://centrum.example.com",
    centrum.WithAPIKey(os.Getenv("CENTRUM_API_KEY")),
)

result, err := client.Execute(ctx, centrum.ExecuteRequest{
    Instruction: "Create a PDF catalog of outdoor products",
})
```

Rust:

```rust
let client = centrum::Client::builder()
    .base_url("https://centrum.example.com")
    .api_key(std::env::var("CENTRUM_API_KEY")?)
    .build()?;

let result = client
    .execute("Create a PDF catalog of outdoor products")
    .await?;
```

## Contract work required before publishing SDKs

The HTTP contract should be stabilized before generated clients are released:

1. Check in an OpenAPI specification as the source of truth.
2. Define explicit request, data, artifact, pagination, warning, and error schemas.
3. Document API-key and artifact-download authentication.
4. Specify timeout, cancellation, continuation-token, and compatibility behavior.
5. Return a request or correlation ID in a stable response header.
6. Adopt a documented versioning and deprecation policy.
7. Add representative examples and conformance fixtures.

Errors should use or align with
[RFC 9457 Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html).
Project-specific fields such as a stable error code, request ID, and bounded trace can
be extensions.

Clients must not automatically retry `POST /v1/execute`. Execution may invoke a model
and incur cost. Retries are safe only after the server implements and enforces an
idempotency contract.

## Publishing and validation

Candidate package channels are npm, PyPI, Maven Central, Go modules, and crates.io.
Names must be checked for availability before publication.

Generated SDKs should be reproducible from the checked-in API specification. CI should:

- validate the OpenAPI document and its examples;
- detect breaking API changes;
- regenerate clients and reject an unexpected diff;
- run language-specific build and lint checks;
- execute smoke tests against a conformance server;
- cover success, validation errors, authentication errors, pagination, and artifacts.

Generated clients may live in dedicated repositories or be attached to releases. The
core repository should avoid carrying large generated trees unless maintaining them
here provides a clear contributor benefit.

## Implementing capabilities in other languages

Calling the HTTP API and authoring a capability are different integration problems.
Capabilities currently implement an in-process TypeScript interface and receive a
trusted `CapabilityContext`, including request-local resources and the authenticated
principal. That interface cannot safely be imported into another process or language.

Cross-language capability authoring therefore requires a Capability Service Protocol.
[gRPC and Protocol Buffers](https://grpc.io/docs/what-is-grpc/introduction/) are a
reasonable candidate because service definitions generate client and server code
across supported languages, including
[Go, Java, Node, Python, and Rust](https://grpc.io/docs/languages/). A tightly specified
internal HTTP protocol is another option, but it needs the same trust controls.

The runtime must continue to own:

- authentication, principals, authorization, and tenant isolation;
- capability registration and allowed schemas;
- deadlines, cancellation, request and result size limits;
- audit events and bounded traces;
- resource-handle validation and delivery sequencing;
- network, filesystem, URL, SQL, and mutation restrictions.

Tenant identity must arrive through authenticated transport context, never through
model-generated capability arguments. A remote capability must not receive credentials,
raw SQL, arbitrary filesystem paths, unrestricted URLs, or unrestricted code execution.

### Resource-handle challenge

Opaque resource handles are currently request-local, typed, and tenant-bound. A remote
Python, Java, Go, or Rust process cannot directly access the in-memory resource store.
Supporting that safely requires one of these designs:

1. Keep repository and resource-producing capabilities inside the TypeScript runtime,
   while allowing only narrowly scoped remote transformations.
2. Build a resource broker that validates signed, expiring, tenant-bound handles.
3. Run language sidecars locally behind an authenticated, restricted transport and
   expose only brokered operations.

Each choice changes the threat model. A protocol should not be implemented until its
authentication, handle lifecycle, tenant binding, failure behavior, and deployment
boundaries have been reviewed.

## Recommended delivery phases

### Phase 1: universal API consumption

- Publish an architecture decision record for the language-neutral API.
- Add the checked-in OpenAPI contract and conformance fixtures.
- Document raw HTTP examples for the five initial languages.
- Generate TypeScript and Python clients as the proof of concept.

### Phase 2: supported SDK matrix

- Publish Java, Go, and Rust clients.
- Add compatibility checks and per-language smoke tests.
- Add idiomatic pagination and authenticated artifact helpers.

### Phase 3: cross-language capability authoring

- Write an ADR and security threat model for the Capability Service Protocol.
- Prototype one restricted sidecar transport.
- Validate tenant isolation, resource handles, deadlines, and audit behavior.
- Expand language support only after the protocol passes security review.

This sequence gives developers in every target language immediate access to AI
Interfaces while preserving the governed TypeScript runtime as the single security and
policy authority.
