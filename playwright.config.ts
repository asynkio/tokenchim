import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:5174", headless: true },
  webServer: {
    command: "pnpm run dev",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    env: {
      PORT: "3002",
      VITE_PORT: "5174",
      API_TARGET: "http://127.0.0.1:3002",
      DATABASE_PATH: `/tmp/tokenchim-browser-${process.pid}.sqlite`,
      DEEPSEEK_API_KEY: "",
      ENV_FILE: "/tmp/tokenchim-no-env",
      BASE_PATH: "/",
      TRUSTED_PROXY_IPS: "",
      API_RATE_LIMIT_PER_MINUTE: "10000",
      DRAW_RATE_LIMIT_PER_MINUTE: "10000",
      READING_RATE_LIMIT_PER_MINUTE: "6",
      READING_CONCURRENCY: "2",
      READING_DAILY_LIMIT: "500",
    },
  },
  workers: 1,
  reporter: "list",
});
