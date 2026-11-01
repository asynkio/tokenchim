import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { ApiError } from "./errors.ts";
import type { DrawService } from "./service.ts";
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (
    !req.headers["content-type"]?.toLowerCase().startsWith("application/json")
  )
    throw new ApiError(415, "请使用 JSON 请求", "INVALID_CONTENT_TYPE");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const b = Buffer.from(chunk);
    length += b.length;
    if (length <= 8192) chunks.push(b);
  }
  if (length > 8192) throw new ApiError(413, "请求内容过长", "BODY_TOO_LARGE");
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error();
    return value;
  } catch {
    throw new ApiError(400, "JSON 请求格式无效", "INVALID_JSON");
  }
}
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
export function createApp(
  service: DrawService,
  options: { staticDir?: string; basePath?: string } = {},
) {
  const root = resolve(options.staticDir ?? "dist");
  const base = (options.basePath ?? "/").replace(/\/$/, "") + "/";
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (!url.pathname.startsWith(base))
        throw new ApiError(404, "页面不存在", "NOT_FOUND");
      const path = url.pathname.slice(base.length - 1);
      if (path.startsWith("/api/")) {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host)
          throw new ApiError(403, "不允许此来源的请求", "INVALID_ORIGIN");
        if (req.method === "GET" && path === "/api/health") {
          json(res, 200, {
            ready: true,
            interpretationConfigured: service.configured,
          });
          return;
        }
        if (req.method === "POST" && path === "/api/draws") {
          json(res, 201, service.draw((await body(req)).count));
          return;
        }
        if (req.method === "POST" && path === "/api/draws/import") {
          json(res, 200, service.import(await body(req)));
          return;
        }
        const match = path.match(
          /^\/api\/draws\/([a-f0-9-]{36})(\/interpret)?$/,
        );
        if (match && req.method === "GET" && !match[2]) {
          json(res, 200, service.get(match[1]));
          return;
        }
        if (match && req.method === "POST" && match[2]) {
          const record = await service.interpret(
            match[1],
            req.socket.remoteAddress ?? "local",
          );
          json(res, 200, record);
          return;
        }
        throw new ApiError(404, "接口不存在", "NOT_FOUND");
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new ApiError(405, "不支持的请求方式", "METHOD_NOT_ALLOWED");
      let decoded: string;
      try {
        decoded = decodeURIComponent(path);
      } catch {
        throw new ApiError(400, "路径格式无效");
      }
      const file = resolve(
        root,
        "." + (decoded === "/" ? "/index.html" : decoded),
      );
      if (!file.startsWith(root + sep))
        throw new ApiError(404, "页面不存在", "NOT_FOUND");
      try {
        const info = await stat(file);
        if (!info.isFile()) throw Error();
        const content = await readFile(file);
        res.writeHead(200, {
          "Content-Type": MIME[extname(file)] ?? "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(req.method === "HEAD" ? undefined : content);
      } catch {
        throw new ApiError(404, "页面不存在", "NOT_FOUND");
      }
    } catch (error) {
      if (res.destroyed || res.headersSent) return;
      const e =
        error instanceof ApiError
          ? error
          : new ApiError(500, "服务暂时不可用，请稍后重试", "INTERNAL_ERROR");
      if (e.retryAfter) res.setHeader("Retry-After", e.retryAfter);
      json(res, e.status, { error: { code: e.code, message: e.message } });
    }
  });
}
