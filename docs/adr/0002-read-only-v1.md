# ADR 0002: Read-only v1

Status: Accepted

The first release supports catalog reads and artifact generation only. Mutation
capabilities require a separate approval, idempotency, compensation, and audit design.
Proving those semantics prematurely would weaken the safety story of the initial
framework. Read-only policy is therefore enforced before model execution and again
through capability allowlisting.
