import { ApiError } from "./errors.ts";

/** Fixed windows start with the first accepted request, not the wall-clock minute. */
export class MinuteLimit {
  private entries = new Map<string, { count: number; reset: number }>();
  private nextSweep = 0;
  constructor(
    private limit: number,
    private code: string,
    private message: string,
    private capacity = 10000,
  ) {}
  check(ip: string, now: number) {
    if (now >= this.nextSweep || this.entries.size >= this.capacity) {
      for (const [key, entry] of this.entries)
        if (entry.reset <= now) this.entries.delete(key);
      this.nextSweep = now + 1000;
    }
    const entry = this.entries.get(ip);
    if (entry && entry.reset > now && entry.count >= this.limit)
      throw new ApiError(
        429,
        this.message,
        this.code,
        Math.max(1, Math.ceil((entry.reset - now) / 1000)),
      );
    if (!entry && this.entries.size >= this.capacity) {
      let reset = now + 60000;
      for (const entry of this.entries.values())
        reset = Math.min(reset, entry.reset);
      throw new ApiError(
        429,
        "请求较多，请稍后重试",
        this.code,
        Math.max(1, Math.ceil((reset - now) / 1000)),
      );
    }
  }
  consume(ip: string, now: number) {
    this.check(ip, now);
    const previous = this.entries.get(ip);
    const entry =
      previous && previous.reset > now
        ? previous
        : { count: 0, reset: now + 60000 };
    entry.count++;
    this.entries.set(ip, entry);
  }
}

export function readingDay(now: number) {
  const offset = 8 * 60 * 60 * 1000;
  const day = Math.floor((now + offset) / 86400000);
  return {
    key: new Date(day * 86400000).toISOString().slice(0, 10),
    retryAfter: Math.max(
      1,
      Math.ceil(((day + 1) * 86400000 - offset - now) / 1000),
    ),
  };
}
