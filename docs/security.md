# Security automation

Centrum treats model output, tool output, database values, and persisted artifacts as
untrusted input. The repository's security checks are designed to catch dependency and
source-level issues without requiring application credentials.

## Automated checks

The `Security` workflow runs on pull requests and pushes to `main`, with a weekly
scheduled run:

- CodeQL analyzes the TypeScript and JavaScript source.
- Dependency review blocks pull requests that introduce high-severity dependencies.
- `pnpm audit` checks production dependencies against the package registry advisory
  database and surfaces findings in the workflow. The audit step is intentionally
  non-blocking while known transitive development-tool advisories are being upgraded;
  dependency review remains the blocking gate for new pull-request risk.
- CycloneDX generates a dependency SBOM and uploads it as a short-lived workflow
  artifact for release and incident review.

These checks are complementary. A clean result is not a guarantee that the application
is secure, and a registry advisory may require maintainer triage before upgrading.

## Repository settings

GitHub secret scanning and push protection are repository-level controls and cannot be
enabled from a workflow file. Maintainers should enable both under **Settings → Code
security and analysis**. Also require the `Security / CodeQL` and
`Security / Dependency review` checks on the protected `main` branch once the workflow
has completed its first run.

No API key is needed by any security job. The live LLM workflow remains a separate,
manually dispatched job and must never be made a required check for ordinary changes.

## Local checks

From a checkout with the pinned toolchain:

```bash
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level high
pnpm dlx --yes @cyclonedx/cyclonedx-npm --output-file sbom.json --output-format JSON
```

Do not commit `sbom.json`; generated reports belong in CI artifacts or an approved
release archive.

