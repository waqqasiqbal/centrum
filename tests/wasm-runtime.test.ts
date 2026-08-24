import { describe, expect, it } from "vitest";
import { executeWasmTransform } from "../packages/core/src/index.js";

const addTwentyFive = "AGFzbQEAAAABBgFgAX8BfwMCAQAHEQENdHJhbnNmb3JtX2kzMgAACgkBBwAgAEEZags=";

describe("Wasm transform runtime", () => {
  it("executes a persisted transform against rows without host access", async () => {
    const rows = await executeWasmTransform(
      [{ id: "p-1", stock: 3 }, { id: "p-2", stock: 7 }],
      { version: 1, runtime: "wasm-core-v1", moduleBase64: addTwentyFive,
        entrypoint: "transform_i32", inputField: "stock", outputField: "stockWithBonus", timeoutMs: 100 },
    );
    expect(rows).toEqual([
      { id: "p-1", stock: 3, stockWithBonus: 28 },
      { id: "p-2", stock: 7, stockWithBonus: 32 },
    ]);
  });
});

