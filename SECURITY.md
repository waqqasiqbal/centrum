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

The development key-discovery endpoint requires `AI_ENABLE_DEMO_KEYS=true` and is
unavailable under `NODE_ENV=production`.
Never commit `.data`, `.env`, or generated API keys.

## Reporting

Do not open public issues for vulnerabilities. Until a dedicated security address is
published, use the repository host's private vulnerability-reporting feature.

Supported security fixes target the latest `0.1.x` release.
