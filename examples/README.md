# Centrum client examples

These examples call a self-hosted Centrum server over HTTP. They work with the
reference server in this repository and provide a starting point for clients in
Python, JavaScript, Java, Go, and Rust.

## Start a local server

From the repository root:

```bash
npx pnpm@10.14.0 install
npx pnpm@10.14.0 demo:seed
npx pnpm@10.14.0 dev:server
```

The server listens on `http://localhost:3000`. `demo:seed` prints development API
keys. Export one key before running a client:

```bash
export CENTRUM_BASE_URL=http://localhost:3000
export CENTRUM_API_KEY='paste-a-demo-key-here'
```

The examples use `POST /v1/execute` for live LLM interpretation and
`POST /v1/persisted-apis` plus `GET /v1/persisted/{slug}` for the cost-saving persisted
path. Persisted API creation invokes the LLM once; subsequent invocation does not.
The [Wasm runtime sample](wasm-runtime/README.md) demonstrates a persisted transform
that contains executable code and produces a new field instead of replaying a stored
response.

## Run an example

```bash
python3 examples/python/client.py
node examples/javascript/client.mjs
cd examples/go && go run .
cd examples/java && javac Main.java && java Main
cd examples/rust && cargo run
```

JavaScript requires Node.js 18+ for built-in `fetch`; the Centrum runtime itself
requires Node.js 24+.

These clients are intentionally small HTTP examples. In production, add authentication
between your users and Centrum, keep API keys in a secret manager, use HTTPS, handle
timeouts and retries, and never accept a tenant ID from model-generated input.

