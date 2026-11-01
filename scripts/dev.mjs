import { spawn } from "node:child_process";
const envFile = process.env.ENV_FILE ?? ".env.local";
try {
  process.loadEnvFile(envFile);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
process.env.API_TARGET ??= `http://127.0.0.1:${process.env.PORT ?? 3001}`;
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
}
children.push(
  spawn(
    process.execPath,
    [
      `--env-file-if-exists=${envFile}`,
      "--import",
      "tsx",
      "--watch",
      "server/index.ts",
    ],
    { stdio: "inherit" },
  ),
);
children.push(
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"],
    { stdio: "inherit" },
  ),
);
for (const child of children) {
  child.on("error", () => stop(1));
  child.on("exit", (code) => stop(code ?? 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
