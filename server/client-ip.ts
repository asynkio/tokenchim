import { isIP } from "node:net";

export function normalizeIp(value: string): string | null {
  if (!isIP(value) || value.includes("%")) return null;
  if (isIP(value) === 4) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = canonical.match(/^::ffff:([a-f0-9]+):([a-f0-9]+)$/);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16),
    low = parseInt(mapped[2], 16);
  return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
}

export function clientIp(
  remoteAddress: string | undefined,
  forwarded: string | string[] | undefined,
  trusted: ReadonlySet<string>,
): string {
  const peer = normalizeIp(remoteAddress ?? "") ?? "unknown";
  if (trusted.has(peer) && typeof forwarded === "string") {
    const candidate = normalizeIp(forwarded.trim());
    if (candidate) return candidate;
  }
  return peer;
}
