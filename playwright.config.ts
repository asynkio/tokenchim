import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:5174", headless: true },
  webServer: {
    command: "npm run dev",
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
    },
  },
  workers: 1,
  reporter: "list",
});
