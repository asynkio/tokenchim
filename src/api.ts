import type { DrawRecord, Health } from "./contracts";
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const value = await response.json();
  if (!response.ok) {
    const message = value.error?.message ?? "请求失败，请重试";
    const retryAfter = response.headers.get("Retry-After");
    const seconds =
      retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
    throw Error(
      response.status === 429 &&
        seconds > 0 &&
        value.error?.code !== "DAILY_READING_LIMIT"
        ? `${message}（请在 ${seconds} 秒后重试）`
        : message,
    );
  }
  return value as T;
}
export const health = () => api<Health>("health");
export const createDraw = (count: number, signal?: AbortSignal) =>
  api<DrawRecord>("draws", { count }, signal);
export const getDraw = (id: string, signal?: AbortSignal) =>
  api<DrawRecord>(`draws/${id}`, undefined, signal);
export const interpretDraw = (id: string, signal?: AbortSignal) =>
  api<DrawRecord>(`draws/${id}/interpret`, {}, signal);
export function loadShare(hash: string, signal?: AbortSignal) {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (p.has("draw")) {
    const id = p.get("draw")!;
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)
    )
      throw Error("分享签单编号无效");
    return getDraw(id, signal);
  }
  const raw = p.get("ids") ?? "";
  if (!/^\d+(,\d+){0,9}$/.test(raw)) throw Error("分享链接数量或格式无效");
  return api<DrawRecord>(
    "draws/import",
    {
      version: p.get("v"),
      ratingVersion: p.get("r"),
      ids: raw.split(",").map(Number),
    },
    signal,
  );
}
export function drawLink(record: DrawRecord) {
  return (
    location.href.split("#")[0] + "#" + new URLSearchParams({ draw: record.id })
  );
}
