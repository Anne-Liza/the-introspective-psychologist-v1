import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const hmrClientPort = Number(env.VITE_HMR_CLIENT_PORT || 5173);

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      hmr: {
        host: "localhost",
        clientPort: hmrClientPort,
      },
    },
  };
});
