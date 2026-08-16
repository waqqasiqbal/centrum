export const errorCodes = [
  "AUTHENTICATION_FAILED",
  "POLICY_DENIED",
  "INVALID_REQUEST",
  "UNSUPPORTED_FILTER",
  "UNSUPPORTED_OUTPUT",
  "NEEDS_CLARIFICATION",
  "RESULT_LIMIT_EXCEEDED",
  "MODEL_TIMEOUT",
  "RATE_LIMITED",
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export class AIInterfaceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AIInterfaceError";
  }
}

export function toErrorEnvelope(error: unknown, requestId: string, durationMs: number) {
  const safe =
    error instanceof AIInterfaceError
      ? error
      : new AIInterfaceError("INTERNAL_ERROR", "The request could not be completed.", 500);

  return {
    protocolVersion: "1.0" as const,
    requestId,
    status: "failed" as const,
    error: {
      code: safe.code,
      message: safe.message,
      ...(safe.details ? { details: safe.details } : {}),
    },
    trace: { durationMs },
    warnings: [],
  };
}
