# Capability authoring

A capability is the only operation a model may request. Keep it narrow, typed, and
auditable.

```ts
import { z } from "zod";
import type { Capability } from "@ai-interfaces/core";

const input = z.object({ query: z.string().max(100) }).strict();

export const searchExample: Capability<z.infer<typeof input>> = {
  name: "search_example",
  description: "Search the authenticated tenant's example records.",
  inputSchema: input,
  parameters: {
    type: "object",
    properties: { query: { type: "string", maxLength: 100 } },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(args, context) {
    // Inject context.principal.tenantId here; never accept it from args.
    // Store reusable canonical data in context.resources and return its opaque handle.
    return { accepted: true };
  },
};
```

## Review checklist

- The JSON schema is strict and matches runtime validation.
- All model-controlled values have size, enum, or range constraints.
- Authorization and tenant scope come from `CapabilityContext`.
- SQL identifiers and operators are mapped from allowlists, never interpolated.
- Side effects have an approval and idempotency design; v1 does not register them.
- Tool output contains the minimum data needed for the next step.
- Tests cover invalid arguments, cross-tenant attempts, and prompt-like data.
