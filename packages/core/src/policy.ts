import { AIInterfaceError } from "./errors.js";
import type { Capability, ExecuteRequest, Policy, Principal } from "./types.js";

const mutationPattern =
  /\b(delete|remove|destroy|drop|truncate|update|edit|change|insert|refund|purchase)\b|create\s+(?:a\s+|an\s+|new\s+)?(?:product|item|catalog entry)\b/i;
const dangerousPattern =
  /\b(raw sql|database credentials?|filesystem|shell|terminal|environment variables?|api keys?)\b/i;
const unsupportedOutputPattern = /\b(csv|xlsx|excel|xml|word|docx|html)\b/i;

export class ReadOnlyPolicy implements Policy {
  preflight(request: ExecuteRequest): void {
    const instruction = request.instruction.trim();
    if (instruction.length < 3) {
      throw new AIInterfaceError(
        "NEEDS_CLARIFICATION",
        "Describe which products you want and whether the output should be JSON or PDF.",
      );
    }
    if (mutationPattern.test(instruction) || dangerousPattern.test(instruction)) {
      throw new AIInterfaceError(
        "POLICY_DENIED",
        "This interface is read-only and cannot perform mutations or access infrastructure.",
        403,
      );
    }
    if (unsupportedOutputPattern.test(instruction)) {
      throw new AIInterfaceError(
        "UNSUPPORTED_OUTPUT",
        "Version 1 supports JSON and PDF output only.",
      );
    }
    if (!/\b(product|products|catalog|inventory|items?)\b/i.test(instruction)) {
      throw new AIInterfaceError(
        "NEEDS_CLARIFICATION",
        "Version 1 can answer product catalog requests. Mention the products you need.",
      );
    }
  }

  canUse(capability: Capability, principal: Principal): boolean {
    return principal.capabilities.includes(capability.name);
  }
}
