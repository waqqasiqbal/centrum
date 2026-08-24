# Public demo hosting plan

## Recommendation

Use a two-service demo first:

1. Deploy the React playground as a static site on Cloudflare Pages or GitHub Pages.
2. Deploy the Fastify reference API as a long-lived Node.js web service on Render.
3. Configure the playground with the public API base URL.
4. Seed a dedicated demo tenant and keep all demo data synthetic.

This matches Centrum's current shape: the playground is static, while the API needs
Node.js, SQLite, WebAssembly workers, environment secrets, and a process that stays
available between requests.

## Hosting options researched

| Option | Best use | Strengths | Current limitation for Centrum |
| --- | --- | --- | --- |
| Render web service | First public API demo | Official Fastify deployment guide, Git-based auto-deploys, persistent disk option | Persistent disks are a paid service feature; use a managed database when the demo becomes durable |
| Railway service | Fastify API alternative | GitHub/Docker deployment, service variables, volumes, logs, and metrics | SQLite requires a volume; avoid treating ephemeral storage as durable |
| Fly.io Machine | Later regional or Docker deployment | Node/Docker deployment and attached volumes | More operational setup; volumes are per-machine and need an explicit backup plan |
| Cloudflare Pages | Static playground | Git-connected React builds, preview deployments, CDN delivery | Not the current home for the Node Fastify API or `node:sqlite` catalog |
| Vercel Functions | Future serverless adapter | Fastify and Node function deployment are supported | Requires an adapter and a serverless-safe persistence design; do not put the current SQLite reference server there unchanged |
| GitHub Codespaces | Temporary reviewer preview | Public forwarded ports can share a live development process | Session-bound, not a stable public demo or production service |

Official references: [Render Fastify deployment](https://render.com/docs/deploy-node-fastify-app),
[Render persistent disks](https://render.com/docs/disks), [Railway services](https://docs.railway.com/services),
[Railway volumes](https://docs.railway.com/volumes), [Fly volumes](https://fly.io/docs/js/the-basics/volumes/),
[Cloudflare Pages React deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/),
[Vercel Fastify](https://vercel.com/docs/frameworks/backend/fastify), and
[GitHub Codespaces port forwarding](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).

## Demo safety requirements

- Use synthetic catalog data and a dedicated demo tenant.
- Never expose `OPENAI_API_KEY`, cursor secrets, database credentials, or demo seed keys
  in browser code, repository files, logs, or screenshots.
- Add a server-side rate limit and a small request/result budget before public launch.
- Disable demo-key discovery in production and provide a short-lived demo access path.
- Keep persisted API creation and invocation authenticated and tenant-scoped.
- Add a visible reset operation for demo data; do not use production data.
- Log provider calls, persisted invocations, errors, and latency without logging prompts
  that may contain secrets or hidden reasoning.
- Add health checks and an uptime check before public announcement.

## Deployment sequence

1. Add a production-safe `start` command and bind Fastify to `0.0.0.0`.
2. Add environment-driven API origin and CORS configuration for the playground.
3. Add a demo seed command that is idempotent and cannot target production data.
4. Deploy the API privately and validate health, live execution, persistence, and reset.
5. Deploy the static playground against the API URL.
6. Run the full demo from a clean browser and record the provider-call reduction.
7. Publish the demo URL, source link, reset policy, limitations, and uptime status.

## Decision rule

Use Render first for the API and Cloudflare Pages first for the playground. Revisit Railway
or Fly.io when we need a Docker-first deployment, regional placement, or a different
operational model. Revisit Vercel only after a serverless adapter and external durable
database are implemented.

