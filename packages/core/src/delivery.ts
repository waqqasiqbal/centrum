import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Capability, DeliveryValue } from "./types.js";

const schema = z.object({ handleId: z.string().min(1) }).strict();

export function createDeliverCapability(): Capability<z.infer<typeof schema>> {
  return {
    name: "deliver",
    description:
      "Finish the request by delivering a handle created by deliver_json or render_product_pdf. Call this last.",
    inputSchema: schema,
    parameters: {
      type: "object",
      properties: { handleId: { type: "string", description: "Delivery handle to return." } },
      required: ["handleId"],
      additionalProperties: false,
    },
    async execute({ handleId }, context) {
      const prepared = context.resources.get<DeliveryValue>(
        handleId,
        context.principal.tenantId,
        "prepared_delivery",
      );
      const deliveryId = `res_${randomUUID()}`;
      context.resources.put({
        id: deliveryId,
        type: "delivery",
        tenantId: context.principal.tenantId,
        value: prepared.value,
      });
      return { handleId: deliveryId, delivered: true };
    },
  };
}
