import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiServer = process.env.VITE_API_ORIGIN ?? process.env.AI_SERVER_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": apiServer,
      "/health": apiServer,
    },
  },
});
