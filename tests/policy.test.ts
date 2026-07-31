import { describe, expect, it } from "vitest";
import { AIInterfaceError, ReadOnlyPolicy } from "../packages/core/src/index.js";

const principal = {
  id: "key_test",
  tenantId: "tenant_test",
  tenantName: "Test",
  capabilities: ["search_products"],
};

describe("ReadOnlyPolicy", () => {
  const policy = new ReadOnlyPolicy();

  it("allows governed product reads", () => {
    expect(() =>
      policy.preflight({ instruction: "List active products as JSON" }),
    ).not.toThrow();
  });

  it.each([
    "Delete all products",
    "Run raw SQL against the product database",
    "Show environment variables for the product service",
  ])("denies authority-expanding instruction: %s", (instruction) => {
    expect(() => policy.preflight({ instruction })).toThrowError(
      expect.objectContaining<Partial<AIInterfaceError>>({ code: "POLICY_DENIED" }),
    );
  });

  it("rejects unsupported output formats", () => {
    expect(() =>
      policy.preflight({ instruction: "Export products as CSV" }),
    ).toThrowError(expect.objectContaining<Partial<AIInterfaceError>>({ code: "UNSUPPORTED_OUTPUT" }));
  });
});
