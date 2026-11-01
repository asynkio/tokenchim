import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode }) => {
  // Only explicitly selected settings are exposed to Vite; API keys remain server-only.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const base = env.BASE_PATH ?? "/";
  return {
    base,
    server: {
      port: Number(env.VITE_PORT ?? 5173),
      strictPort: true,
      proxy: {
        [`${base.replace(/\/$/, "")}/api`]: {
          target: env.API_TARGET ?? `http://127.0.0.1:${env.PORT ?? 3001}`,
          changeOrigin: false,
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          rules: fileURLToPath(new URL("./rules.html", import.meta.url)),
        },
      },
    },
  };
});
