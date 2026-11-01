import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Dataset } from "../src/core.ts";
import { readLimits } from "./config.ts";
import { Store } from "./store.ts";
import { DrawService } from "./service.ts";
import { createApp } from "./http.ts";
const limits = readLimits();
const store = new Store(process.env.DATABASE_PATH ?? "var/tokenchim.sqlite");
const dataset: Dataset = JSON.parse(
  readFileSync(resolve("public/data/tokens.json"), "utf8"),
);
const service = new DrawService(store, dataset, {
  ...limits,
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
});
const app = createApp(service, { ...limits, basePath: process.env.BASE_PATH });
const host = process.env.HOST ?? "127.0.0.1",
  port = Number(process.env.PORT ?? 3001);
app.listen(port, host, () =>
  console.log(
    `TokenChim API: http://${host}:${port}${process.env.BASE_PATH ?? "/"} (DeepSeek ${service.configured ? "configured" : "not configured"})`,
  ),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise<void>((resolve) => app.close(() => resolve()));
  await service.drain();
  store.close();
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
