import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}
const { app, demoKeys, provider } = await createApp();

await app.listen({ port, host });
app.log.info({
  event: "ai_interface.ready",
  provider: provider.name,
  demoTenants: demoKeys.map(({ tenantName }) => tenantName),
  url: `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`,
});

const shutdown = async (signal: string) => {
  app.log.info({ event: "ai_interface.shutdown", signal });
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

