import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { z } from "zod";
import {
  AIInterfaceError,
  type Capability,
  type DeliveryValue,
} from "@ai-interfaces/core";
import type { CatalogDatabase, ProductSet } from "@ai-interfaces/catalog";

const jsonSchema = z.object({ resultHandleId: z.string().min(1) }).strict();
const pdfSchema = z
  .object({
    resultHandleId: z.string().min(1),
    title: z.string().min(1).max(100).default("Product Catalog"),
    columns: z
      .array(z.enum(["name", "sku", "category", "price", "currency", "stock", "active"]))
      .min(1)
      .max(7)
      .default(["name", "sku", "category", "price", "currency", "stock"]),
  })
  .strict();

export function createRendererCapabilities(
  database: CatalogDatabase,
  artifactDirectory: string,
): Capability[] {
  return [createJsonCapability(), createPdfCapability(database, artifactDirectory)];
}

function createJsonCapability(): Capability<z.infer<typeof jsonSchema>> {
  return {
    name: "deliver_json",
    description:
      "Prepare a product result handle as deterministic JSON. Product values are copied from the governed result set.",
    inputSchema: jsonSchema,
    parameters: {
      type: "object",
      properties: { resultHandleId: { type: "string" } },
      required: ["resultHandleId"],
      additionalProperties: false,
    },
    async execute({ resultHandleId }, context) {
      const result = context.resources.get<ProductSet>(
        resultHandleId,
        context.principal.tenantId,
        "product_set",
      ).value;
      if (result.rows.length > 100) {
        throw new AIInterfaceError(
          "RESULT_LIMIT_EXCEEDED",
          "JSON output is limited to 100 products per page.",
        );
      }
      const handleId = `delivery_${randomUUID()}`;
      const delivery: DeliveryValue = {
        output: { kind: "data", mediaType: "application/json", data: result.rows },
        pagination: { nextToken: result.nextToken, hasMore: result.hasMore },
      };
      context.resources.put({
        id: handleId,
        type: "prepared_delivery",
        tenantId: context.principal.tenantId,
        value: delivery,
      });
      return { handleId, resultCount: result.rows.length };
    },
  };
}

function createPdfCapability(
  database: CatalogDatabase,
  artifactDirectory: string,
): Capability<z.infer<typeof pdfSchema>> {
  return {
    name: "render_product_pdf",
    description:
      "Render up to 1,000 governed product rows as a fixed-layout PDF and return an opaque delivery handle.",
    inputSchema: pdfSchema,
    parameters: {
      type: "object",
      properties: {
        resultHandleId: { type: "string" },
        title: { type: "string", maxLength: 100 },
        columns: {
          type: "array",
          items: {
            type: "string",
            enum: ["name", "sku", "category", "price", "currency", "stock", "active"],
          },
          minItems: 1,
          maxItems: 7,
        },
      },
      required: ["resultHandleId", "title", "columns"],
      additionalProperties: false,
    },
    async execute({ resultHandleId, title, columns }, context) {
      const result = context.resources.get<ProductSet>(
        resultHandleId,
        context.principal.tenantId,
        "product_set",
      ).value;
      if (result.hasMore && result.rows.length >= 1000) {
        throw new AIInterfaceError(
          "RESULT_LIMIT_EXCEEDED",
          "PDF output is limited to 1,000 products. Add filters to narrow the result.",
        );
      }
      fs.mkdirSync(artifactDirectory, { recursive: true, mode: 0o700 });
      const artifactId = `artifact_${randomUUID()}`;
      const filename = `${slugify(title)}-${artifactId.slice(-8)}.pdf`;
      const filePath = path.join(artifactDirectory, `${artifactId}.pdf`);
      await writePdf(filePath, title, columns, result.rows);
      const byteSize = fs.statSync(filePath).size;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      database.saveArtifact({
        id: artifactId,
        tenantId: context.principal.tenantId,
        filename,
        path: filePath,
        byteSize,
        expiresAt,
        mediaType: "application/pdf",
      });
      const handleId = `delivery_${randomUUID()}`;
      const delivery: DeliveryValue = {
        output: {
          kind: "artifact",
          mediaType: "application/pdf",
          artifact: {
            id: artifactId,
            filename,
            byteSize,
            expiresAt,
            downloadUrl: `/v1/artifacts/${artifactId}`,
          },
        },
      };
      context.resources.put({
        id: handleId,
        type: "prepared_delivery",
        tenantId: context.principal.tenantId,
        value: delivery,
      });
      context.emit({ type: "render", name: "pdf", resultCount: result.rows.length });
      return { handleId, artifactId, resultCount: result.rows.length };
    },
  };
}

async function writePdf(
  filePath: string,
  title: string,
  columns: string[],
  rows: Array<Record<string, unknown>>,
) {
  await new Promise<void>((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 42, info: { Title: title } });
    const stream = fs.createWriteStream(filePath, { mode: 0o600 });
    document.pipe(stream);
    document.fontSize(20).fillColor("#17233c").text(title);
    document.moveDown(0.25);
    document.fontSize(9).fillColor("#667085").text(`Generated ${new Date().toISOString()}`);
    document.moveDown();
    document.fontSize(8).fillColor("#17233c");
    const widths = columns.map(() => (511 / columns.length));
    drawRow(document, columns.map(titleCase), widths, true);
    rows.forEach((row) => {
      if (document.y > 740) {
        document.addPage();
        drawRow(document, columns.map(titleCase), widths, true);
      }
      drawRow(document, columns.map((column) => formatCell(row[column], column)), widths, false);
    });
    document.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function drawRow(document: PDFKit.PDFDocument, cells: string[], widths: number[], heading: boolean) {
  const y = document.y;
  if (heading) document.rect(42, y - 2, 511, 18).fill("#e8eef9").fillColor("#17233c");
  let x = 46;
  cells.forEach((cell, index) => {
    document.font(heading ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).text(cell, x, y + 3, {
      width: widths[index] - 8,
      height: 13,
      ellipsis: true,
    });
    x += widths[index];
  });
  document.y = y + 18;
  document.moveTo(42, document.y).lineTo(553, document.y).strokeColor("#d0d5dd").stroke();
}

function formatCell(value: unknown, column: string) {
  if (column === "active") return value ? "Yes" : "No";
  if (column === "price" && typeof value === "number") return value.toFixed(2);
  return String(value ?? "");
}

function titleCase(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "products";
}
