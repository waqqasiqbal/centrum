# Flagship multi-table analytics demo

This example shows the intended persisted-API shape for a real data workflow:

1. A governed LLM interaction selects the stable `customer-revenue-v1` plan.
2. Host-owned code runs a parameterized read-only query over customers, orders,
   products, order items, and service items.
3. The query uses joins, a `UNION ALL`, filtering, and aggregation.
4. Deterministic application logic calculates average order value and applies a
   priority-customer rule.
5. The JSON response is produced without another LLM call.

Run it from the repository root:

```bash
npx tsx examples/analytics/run.ts
```

The sample returns Nora's two completed orders (`525` revenue and `262.5`
average order value) and Oliver's completed order (`145` revenue). Pending
orders are excluded.

The SQL and business rules are intentionally visible because they are the
deterministic artifact that replaces repeated model interpretation. In the
server, a model does **not** receive raw SQL, database credentials, filesystem
paths, or tenant IDs. The authenticated principal supplies tenant scope, and
the host maps a validated plan identifier to this SQL. The standalone example
takes a tenant ID only to make tenant isolation testable; it is not a
model-facing API argument.

This is synthetic data and a local demonstration, not a production database
adapter. The existing persisted API HTTP flow remains the integration boundary;
this example focuses on proving that complex joins and post-query logic can be
compiled into a repeatable, read-only API flow.

