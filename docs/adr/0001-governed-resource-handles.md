# ADR 0001: Governed resource handles

Status: Accepted

## Context

Allowing a model to author database queries or final business records makes flexible
interfaces unsafe and unverifiable. Passing entire result sets between model calls also
increases disclosure and prompt-injection risk.

## Decision

Capabilities execute validated operations and store results in a request-local resource
store. Tools return opaque handles. Every handle has a type and tenant owner. Renderers
resolve handles through the runtime and construct canonical output without model-authored
record values. A dedicated `deliver` capability terminates execution.

## Consequences

The model retains control over intent and sequencing but not authority or business truth.
Capabilities and renderers are composable. Cross-request workflows will require an
explicit durable handle design rather than reusing these ephemeral handles.
