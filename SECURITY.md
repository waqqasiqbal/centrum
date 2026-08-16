# Security Policy

## Prototype warning

Version 0.1.0 is a research prototype, not a production authorization system. Before
production use, add a managed identity provider, secret manager, durable artifact
storage, distributed rate limits and budgets, audit-log retention, abuse monitoring,
dependency scanning, and deployment-specific data controls. The prototype includes
per-process rate limits and a 16 KiB body limit; production must enforce equivalent
limits at the edge as well.

## Design boundaries

The model does not receive credentials, tenant identifiers, raw SQL, file paths, or
mutation tools. Server-side policy and repositories remain the authority boundary.
Treat model output as untrusted even when strict schemas are enabled.

Persisted API management is a separate authenticated server operation, not a model
tool. It accepts bounded JSON only, requires explicit key capabilities, scopes every
lookup to the authenticated tenant, requires idempotency for creation, uses optimistic
versions for updates, and records mutation history and audit events. Persisted routes
remain authenticated; this prototype does not provide anonymous public endpoints.

The development key-discovery endpoint requires `AI_ENABLE_DEMO_KEYS=true` and is
unavailable under `NODE_ENV=production`.
Never commit `.data`, `.env`, or generated API keys.

## Reporting

Do not open public issues for vulnerabilities. Use GitHub's private vulnerability
reporting flow from the repository Security tab. Include affected versions, impact,
reproduction details, and a proposed mitigation when available. Remove real tenant data,
API keys, and credentials from every report.

Supported security fixes target the latest `0.1.x` release.
