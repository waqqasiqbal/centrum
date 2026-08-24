import { describe, expect, it } from "vitest";
import { runAnalyticsDemo } from "../examples/analytics/run.js";

describe("flagship analytics example", () => {
  it("joins and aggregates tenant data, then applies deterministic business logic", () => {
    expect(runAnalyticsDemo("tenant_nordic")).toEqual([
      { customerId: "customer_nora", customerName: "Nora Lind", orderCount: 2, revenue: 525, averageOrderValue: 262.5, segment: "priority" },
      { customerId: "customer_oliver", customerName: "Oliver Berg", orderCount: 1, revenue: 145, averageOrderValue: 145, segment: "standard" },
    ]);
  });

  it("keeps tenant results isolated and excludes pending orders", () => {
    expect(runAnalyticsDemo("tenant_alpine")).toEqual([
      { customerId: "customer_alice", customerName: "Alice Stone", orderCount: 1, revenue: 190, averageOrderValue: 190, segment: "standard" },
    ]);
  });
});

