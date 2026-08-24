# Persisted Wasm transform

This sample is an executable proof of a persisted API transform. The artifact
contains code (a WebAssembly module), not a cached response: it adds 25 to each
row's `stock` value and produces `stockWithBonus`.

Run it from the repository root:

```bash
node examples/wasm-runtime/run.mjs
```

The same artifact can be included as the `wasm` step in a persisted API plan.
Centrum validates the module, disallows imports, runs it in a disposable worker,
and applies it to query results before rendering. This v1 step intentionally
accepts only an `i32 -> i32` function; SQL remains host-controlled and can still
contain joins, unions, and other governed read-only queries.

