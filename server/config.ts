import { normalizeIp } from "./client-ip.ts";

export function readLimits(
  env: Record<string, string | undefined> = process.env,
) {
  function integer(name: string, fallback: number, minimum = 1) {
    const raw = env[name];
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum)
      throw Error(`${name} must be an integer >= ${minimum}`);
    return value;
  }
  const trustedProxyIps = new Set<string>();
  if (env.TRUSTED_PROXY_IPS?.trim())
    for (const raw of env.TRUSTED_PROXY_IPS.split(",")) {
      const ip = normalizeIp(raw.trim());
      if (!ip)
        throw Error(
          "TRUSTED_PROXY_IPS must contain explicit IP addresses separated by commas",
        );
      trustedProxyIps.add(ip);
    }
  return {
    trustedProxyIps,
    apiRateLimit: integer("API_RATE_LIMIT_PER_MINUTE", 120),
    drawRateLimit: integer("DRAW_RATE_LIMIT_PER_MINUTE", 20),
    rateLimit: integer("READING_RATE_LIMIT_PER_MINUTE", 6),
    concurrency: integer("READING_CONCURRENCY", 2),
    dailyLimit: integer("READING_DAILY_LIMIT", 500, 0),
  };
}
