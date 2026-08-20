import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  AIInterfaceError,
  type Capability,
  type Resource,
} from "@ai-interfaces/core";
import type { CatalogDatabase, Product } from "./database.js";

const fields = ["id", "name", "sku", "category", "price", "currency", "stock", "active", "createdAt"] as const;
const filterFields = ["name", "sku", "category", "price", "currency", "stock", "active"] as const;
const sortFields = ["name", "price", "stock", "createdAt"] as const;
const operators = ["eq", "contains", "gt", "gte", "lt", "lte"] as const;

const filterSchema = z
  .object({
    field: z.enum(filterFields),
    operator: z.enum(operators),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })
  .strict();
export const searchProductsInputSchema = z
  .object({
    filters: z.array(filterSchema).max(10).default([]),
    sort: z
      .object({ field: z.enum(sortFields), direction: z.enum(["asc", "desc"]) })
      .strict()
      .default({ field: "name", direction: "asc" }),
    limit: z.number().int().min(1).max(1000).default(25),
    projection: z.array(z.enum(fields)).min(1).max(fields.length).default([...fields]),
    cursor: z.string().nullable().optional(),
  })
  .strict();

export interface ProductSet {
  rows: Array<Partial<Product>>;
  projection: string[];
  nextToken: string | null;
  hasMore: boolean;
  totalReturned: number;
}

export function createSearchProductsCapability(
  database: CatalogDatabase,
  cursorSecret: string,
): Capability<z.infer<typeof searchProductsInputSchema>> {
  return {
    name: "search_products",
    description:
      "Query the authenticated tenant's product catalog using allowlisted filters and stable pagination. Tenant scope is injected by the runtime.",
    inputSchema: searchProductsInputSchema,
    parameters: searchParameters,
    async execute(input, context) {
      validateFilters(input.filters);
      const requestedCursor = context.request.continuationToken ?? input.cursor;
      const cursor = requestedCursor
        ? decodeCursor(requestedCursor, cursorSecret, context.principal.tenantId, input.sort)
        : undefined;
      const query = buildQuery(context.principal.tenantId, input, cursor);
      const rawRows = database.db
        .prepare(query.sql)
        .all(...(query.params as Array<string | number | bigint | null>)) as Array<
        Record<string, unknown>
      >;
      const hasMore = rawRows.length > input.limit;
      const visibleRows = rawRows.slice(0, input.limit).map(normalizeProduct);
      const projectedRows = visibleRows.map((row) =>
        Object.fromEntries(input.projection.map((field) => [field, row[field as keyof Product]])),
      );
      const last = visibleRows.at(-1);
      const nextToken =
        hasMore && last
          ? encodeCursor(
              {
                tenantId: context.principal.tenantId,
                field: input.sort.field,
                direction: input.sort.direction,
                value: last[input.sort.field],
                id: last.id,
              },
              cursorSecret,
            )
          : null;
      const handleId = `products_${randomUUID()}`;
      const value: ProductSet = {
        rows: projectedRows,
        projection: input.projection,
        nextToken,
        hasMore,
        totalReturned: projectedRows.length,
      };
      context.resources.put<Resource<ProductSet>["value"]>({
        id: handleId,
        type: "product_set",
        tenantId: context.principal.tenantId,
        value,
      });
      return { handleId, resultCount: projectedRows.length, hasMore };
    },
  };
}

function validateFilters(filters: z.infer<typeof filterSchema>[]) {
  for (const filter of filters) {
    if (filter.field === "active" && typeof filter.value !== "boolean") {
      throw new AIInterfaceError("UNSUPPORTED_FILTER", "'active' requires a boolean value.");
    }
    if ((filter.field === "price" || filter.field === "stock") && typeof filter.value !== "number") {
      throw new AIInterfaceError("UNSUPPORTED_FILTER", `'${filter.field}' requires a numeric value.`);
    }
    if (filter.operator === "contains" && !["name", "sku", "category"].includes(filter.field)) {
      throw new AIInterfaceError("UNSUPPORTED_FILTER", "'contains' is not allowed for that field.");
    }
  }
}

function buildQuery(
  tenantId: string,
  input: z.infer<typeof searchProductsInputSchema>,
  cursor?: { value: unknown; id: string },
) {
  const column = columnMap[input.sort.field];
  const direction = input.sort.direction.toUpperCase();
  const clauses = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];
  for (const filter of input.filters) {
    const mapped = columnMap[filter.field];
    const operator = operatorMap[filter.operator];
    clauses.push(filter.operator === "contains" ? `${mapped} LIKE ? ESCAPE '\\'` : `${mapped} ${operator} ?`);
    params.push(
      filter.operator === "contains"
        ? `%${String(filter.value).replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`
        : typeof filter.value === "boolean"
          ? Number(filter.value)
          : filter.value,
    );
  }
  if (cursor) {
    const comparator = input.sort.direction === "asc" ? ">" : "<";
    clauses.push(`(${column} ${comparator} ? OR (${column} = ? AND id ${comparator} ?))`);
    params.push(cursor.value, cursor.value, cursor.id);
  }
  params.push(input.limit + 1);
  return {
    sql: `SELECT id, name, sku, category, price, currency, stock, active,
                 created_at as createdAt
            FROM products
           WHERE ${clauses.join(" AND ")}
           ORDER BY ${column} ${direction}, id ${direction}
           LIMIT ?`,
    params,
  };
}

const columnMap: Record<string, string> = {
  id: "id",
  name: "name",
  sku: "sku",
  category: "category",
  price: "price",
  currency: "currency",
  stock: "stock",
  active: "active",
  createdAt: "created_at",
};
const operatorMap: Record<string, string> = {
  eq: "=",
  contains: "LIKE",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

function normalizeProduct(row: Record<string, unknown>): Product {
  return { ...(row as unknown as Product), active: Boolean(row.active) };
}

interface CursorPayload {
  tenantId: string;
  field: string;
  direction: string;
  value: unknown;
  id: string;
}

function encodeCursor(payload: CursorPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function decodeCursor(
  token: string,
  secret: string,
  tenantId: string,
  sort: { field: string; direction: string },
) {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw invalidCursor();
  const expected = createHmac("sha256", secret).update(body).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    throw invalidCursor();
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw invalidCursor();
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as CursorPayload;
    if (
      payload.tenantId !== tenantId ||
      payload.field !== sort.field ||
      payload.direction !== sort.direction ||
      !payload.id
    ) {
      throw invalidCursor();
    }
    return { value: payload.value, id: payload.id };
  } catch {
    throw invalidCursor();
  }
}

function invalidCursor() {
  return new AIInterfaceError("INVALID_REQUEST", "The continuation token is invalid or incompatible.");
}

const searchParameters = {
  type: "object" as const,
  properties: {
    filters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string", enum: filterFields },
          operator: { type: "string", enum: operators },
          value: { type: ["string", "number", "boolean"] },
        },
        required: ["field", "operator", "value"],
        additionalProperties: false,
      },
    },
    sort: {
      type: "object",
      properties: {
        field: { type: "string", enum: sortFields },
        direction: { type: "string", enum: ["asc", "desc"] },
      },
      required: ["field", "direction"],
      additionalProperties: false,
    },
    limit: { type: "integer", minimum: 1, maximum: 1000 },
    projection: { type: "array", items: { type: "string", enum: fields } },
    cursor: { type: ["string", "null"] },
  },
  required: ["filters", "sort", "limit", "projection", "cursor"],
  additionalProperties: false as const,
};
