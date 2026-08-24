import { DatabaseSync } from "node:sqlite";

/** Host-owned persisted plan; models select its id but never receive this SQL. */
export const CUSTOMER_REVENUE_PLAN = {
  version: 1,
  queryId: "customer-revenue-v1",
  renderer: "json",
  logic: ["calculate_average_order_value", "classify_customer_segment"],
} as const;

export interface CustomerRevenue {
  customerId: string;
  customerName: string;
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
  segment: "priority" | "standard";
}

const CUSTOMER_REVENUE_SQL = `
  WITH line_items AS (
    SELECT order_id, quantity * unit_price AS amount FROM order_items
    UNION ALL
    SELECT order_id, quantity * unit_price AS amount FROM service_items
  ),
  customer_totals AS (
    SELECT c.id AS customer_id, c.name AS customer_name,
           COUNT(DISTINCT o.id) AS order_count,
           ROUND(SUM(li.amount), 2) AS revenue
      FROM customers c
      JOIN orders o ON o.customer_id = c.id AND o.tenant_id = c.tenant_id
      JOIN line_items li ON li.order_id = o.id
     WHERE c.tenant_id = ? AND o.status = 'completed'
     GROUP BY c.id, c.name
  )
  SELECT customer_id AS customerId, customer_name AS customerName,
         order_count AS orderCount, revenue
    FROM customer_totals
   ORDER BY revenue DESC, customer_id ASC
`;

export function runAnalyticsDemo(tenantId: string): CustomerRevenue[] {
  const database = new DatabaseSync(":memory:");
  try {
    createSchema(database);
    seedSyntheticData(database);
    const rows = database.prepare(CUSTOMER_REVENUE_SQL).all(tenantId) as Array<{
      customerId: string;
      customerName: string;
      orderCount: number;
      revenue: number;
    }>;
    return rows.map((row) => ({
      ...row,
      averageOrderValue: round(row.revenue / row.orderCount),
      segment: row.revenue >= 500 ? "priority" : "standard",
    }));
  } finally {
    database.close();
  }
}

function createSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE customers (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL);
    CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE orders (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), customer_id TEXT NOT NULL REFERENCES customers(id), status TEXT NOT NULL);
    CREATE TABLE order_items (order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, unit_price REAL NOT NULL);
    CREATE TABLE service_items (order_id TEXT NOT NULL REFERENCES orders(id), service_name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL);
  `);
}

function seedSyntheticData(database: DatabaseSync) {
  database.exec(`
    INSERT INTO tenants VALUES ('tenant_nordic', 'Nordic Outfitters');
    INSERT INTO tenants VALUES ('tenant_alpine', 'Alpine Outfitters');
    INSERT INTO customers VALUES ('customer_nora', 'tenant_nordic', 'Nora Lind');
    INSERT INTO customers VALUES ('customer_oliver', 'tenant_nordic', 'Oliver Berg');
    INSERT INTO customers VALUES ('customer_alice', 'tenant_alpine', 'Alice Stone');
    INSERT INTO products VALUES ('product_pack', 'Trail Pack');
    INSERT INTO products VALUES ('product_jacket', 'Rain Jacket');
    INSERT INTO orders VALUES ('order_nora_1', 'tenant_nordic', 'customer_nora', 'completed');
    INSERT INTO orders VALUES ('order_nora_2', 'tenant_nordic', 'customer_nora', 'completed');
    INSERT INTO orders VALUES ('order_oliver_1', 'tenant_nordic', 'customer_oliver', 'completed');
    INSERT INTO orders VALUES ('order_alice_1', 'tenant_alpine', 'customer_alice', 'completed');
    INSERT INTO orders VALUES ('order_nora_pending', 'tenant_nordic', 'customer_nora', 'pending');
    INSERT INTO order_items VALUES ('order_nora_1', 'product_pack', 2, 180.00);
    INSERT INTO order_items VALUES ('order_nora_2', 'product_jacket', 1, 140.00);
    INSERT INTO order_items VALUES ('order_oliver_1', 'product_jacket', 1, 120.00);
    INSERT INTO order_items VALUES ('order_alice_1', 'product_pack', 1, 180.00);
    INSERT INTO service_items VALUES ('order_nora_2', 'priority-shipping', 1, 25.00);
    INSERT INTO service_items VALUES ('order_oliver_1', 'priority-shipping', 1, 25.00);
    INSERT INTO service_items VALUES ('order_alice_1', 'gift-wrap', 1, 10.00);
  `);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ plan: CUSTOMER_REVENUE_PLAN, data: runAnalyticsDemo("tenant_nordic") }, null, 2));
}

