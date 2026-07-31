import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const { app, demoKeys, provider } = await createApp();

await app.listen({ port, host: "0.0.0.0" });
app.log.info({
  event: "ai_interface.ready",
  provider: provider.name,
  demoTenants: demoKeys.map(({ tenantName }) => tenantName),
  url: `http://localhost:${port}`,
});
