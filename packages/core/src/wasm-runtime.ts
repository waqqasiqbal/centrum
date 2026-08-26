import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import { z } from "zod";
import { AIInterfaceError } from "./errors.js";

const base64Schema = z.string().min(16).max(2_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/);

export const wasmTransformArtifactSchema = z
  .object({
    version: z.literal(1),
    runtime: z.literal("wasm-core-v1"),
    moduleBase64: base64Schema,
    entrypoint: z.literal("transform_i32"),
    inputField: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
    outputField: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
    timeoutMs: z.number().int().min(1).max(1_000).default(100),
    // Optional content address for artifacts produced by a future compiler.
    // When present, the runtime verifies the bytes before instantiation.
    sha256: z.string().length(64).regex(/^[a-f0-9]{64}$/).optional(),
  })
  .strict();

export type WasmTransformArtifact = z.infer<typeof wasmTransformArtifactSchema>;

type JsonRow = Record<string, unknown>;

/**
 * Execute a deliberately narrow Wasm artifact in a disposable worker.
 * The module receives one i32 per row and must return one i32. It may not import
 * host functions, so it has no filesystem, network, database, or credential access.
 */
export async function executeWasmTransform(
  rows: JsonRow[],
  artifact: WasmTransformArtifact,
  signal?: AbortSignal,
): Promise<JsonRow[]> {
  if (rows.length > 1_000) {
    throw new AIInterfaceError("RESULT_LIMIT_EXCEEDED", "Wasm transformations are limited to 1,000 rows.", 413);
  }
  const bytes = Buffer.from(artifact.moduleBase64, "base64");
  if (artifact.sha256) {
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (actualSha256 !== artifact.sha256) {
      throw new AIInterfaceError("INVALID_REQUEST", "The Wasm artifact integrity check failed.", 400);
    }
  }
  let module: WebAssembly.Module;
  try {
    module = await WebAssembly.compile(bytes);
  } catch {
    throw new AIInterfaceError("INVALID_REQUEST", "The Wasm artifact is invalid.", 400);
  }
  if (WebAssembly.Module.imports(module).length > 0) {
    throw new AIInterfaceError("POLICY_DENIED", "Wasm artifacts may not import host capabilities.", 403);
  }
  const exportInfo = WebAssembly.Module.exports(module).find((item) => item.name === artifact.entrypoint);
  if (!exportInfo || exportInfo.kind !== "function") {
    throw new AIInterfaceError("INVALID_REQUEST", "The Wasm artifact has no valid transform entrypoint.", 400);
  }
  const values = rows.map((row) => {
    const value = row[artifact.inputField];
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw new AIInterfaceError("INVALID_REQUEST", `Wasm input '${artifact.inputField}' must be an integer.`, 400);
    }
    return value;
  });
  const transformed = await runInWorker(bytes, artifact.entrypoint, values, artifact.timeoutMs, signal);
  return rows.map((row, index) => ({ ...row, [artifact.outputField]: transformed[index] }));
}

async function runInWorker(
  bytes: Buffer,
  entrypoint: string,
  values: number[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<number[]> {
  const worker = new Worker(
    `const { parentPort, workerData } = require("node:worker_threads");
     try {
       const module = new WebAssembly.Module(workerData.bytes);
       const instance = new WebAssembly.Instance(module, {});
       const fn = instance.exports[workerData.entrypoint];
       if (typeof fn !== "function") throw new Error("invalid entrypoint");
       const values = workerData.values.map((value) => {
         const result = fn(value);
         if (!Number.isInteger(result)) throw new Error("transform must return an integer");
         return result;
       });
       parentPort.postMessage({ ok: true, values });
     } catch (error) {
       parentPort.postMessage({ ok: false, message: error instanceof Error ? error.message : "execution failed" });
     }`,
    { eval: true, workerData: { bytes, entrypoint, values } },
  );
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      void worker.terminate();
      callback();
    };
    const onAbort = () => finish(() => reject(new AIInterfaceError("MODEL_TIMEOUT", "Wasm execution was cancelled.", 504)));
    const timer = setTimeout(() => finish(() => reject(new AIInterfaceError("MODEL_TIMEOUT", "Wasm execution exceeded its time limit.", 504))), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.once("error", (error) => finish(() => reject(new AIInterfaceError("INTERNAL_ERROR", error.message, 500))));
    worker.once("message", (message: { ok: boolean; values?: number[]; message?: string }) => {
      if (!message.ok || !message.values) {
        finish(() => reject(new AIInterfaceError("INVALID_REQUEST", message.message ?? "Wasm execution failed.", 400)));
      } else {
        finish(() => resolve(message.values!));
      }
    });
  });
}
