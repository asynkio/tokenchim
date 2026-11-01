import { randomUUID } from "node:crypto";
import {
  draw,
  decodeShare,
  VOCAB_VERSION,
  RATING_VERSION,
  type Dataset,
  type Token,
} from "../src/core.ts";
import type { DrawRecord } from "../src/contracts.ts";
import { legacyV3 } from "./legacy-v3.ts";
import { Store } from "./store.ts";
import { generateReading, type ProviderOptions } from "./deepseek.ts";
import { ApiError } from "./errors.ts";
export interface ServiceOptions extends ProviderOptions {
  rateLimit?: number;
  concurrency?: number;
  now?: () => number;
}
export class DrawService {
  private tasks = new Map<string, Promise<DrawRecord>>();
  private rates = new Map<string, { count: number; reset: number }>();
  constructor(
    public store: Store,
    private data: Dataset,
    private options: ServiceOptions,
  ) {
    if (
      data.version !== VOCAB_VERSION ||
      data.rating !== RATING_VERSION ||
      data.tokens.length !== 129280 ||
      new Set(data.tokens.map((t) => t.id)).size !== 129280
    )
      throw Error("Offline vocabulary validation failed");
  }
  get configured() {
    return !!this.options.apiKey;
  }
  get(id: string) {
    const record = this.store.get(id);
    if (!record) throw new ApiError(404, "未找到这份签单", "DRAW_NOT_FOUND");
    return record;
  }
  private create(
    tokens: Token[],
    source: DrawRecord["source"],
    key?: string,
    version = VOCAB_VERSION,
  ) {
    const record: DrawRecord = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      version,
      ratingVersion: RATING_VERSION,
      source,
      ids: tokens.map((t) => t.id),
      tokens,
      readingStatus: "idle",
      reading: null,
      readingError: null,
    };
    this.store.insert(record, key);
    return record;
  }
  draw(count: unknown) {
    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 4
    )
      throw new ApiError(400, "抽取数量应为 1–4 的整数", "INVALID_COUNT");
    return this.create(draw(this.data.tokens, count), "random");
  }
  import(input: { version?: unknown; ratingVersion?: unknown; ids?: unknown }) {
    if (
      typeof input.version !== "string" ||
      typeof input.ratingVersion !== "string" ||
      !Array.isArray(input.ids) ||
      input.ids.length < 1 ||
      input.ids.length > 10 ||
      !input.ids.every((id) => Number.isSafeInteger(id) && id >= 0)
    )
      throw new ApiError(400, "分享链接数量或格式无效", "INVALID_SHARE");
    const p = new URLSearchParams({
      v: input.version,
      r: input.ratingVersion,
      ids: input.ids.join(","),
    });
    let tokens: Token[];
    try {
      // Preserve old IDs and grades rather than interpreting them with V4.1 markers.
      const legacy = input.version === legacyV3.version;
      const vocabulary = legacy
        ? this.data.tokens
            .filter((t) => t.id <= legacyV3.maxId)
            .map((t) => legacyV3.overrides.find((old) => old.id === t.id) ?? t)
        : this.data.tokens;
      tokens = decodeShare(
        "#" + p,
        vocabulary,
        legacy ? legacyV3.version : VOCAB_VERSION,
      );
    } catch (e) {
      throw new ApiError(400, (e as Error).message, "INVALID_SHARE");
    }
    const key = p.toString();
    return (
      this.store.imported(key) ??
      this.create(tokens, "legacy", key, input.version)
    );
  }
  interpret(id: string, ip: string): Promise<DrawRecord> {
    const record = this.get(id);
    if (record.readingStatus === "ready") return Promise.resolve(record);
    const task = this.tasks.get(id);
    if (task) return task;
    if (!this.configured)
      throw new ApiError(
        503,
        "尚未配置 DeepSeek API，请在后端设置 DEEPSEEK_API_KEY",
        "NOT_CONFIGURED",
      );
    const now = (this.options.now ?? Date.now)();
    for (const [key, value] of this.rates)
      if (value.reset <= now) this.rates.delete(key);
    if (this.tasks.size >= (this.options.concurrency ?? 2))
      throw new ApiError(429, "当前释读较多，请稍后重试", "BUSY", 2);
    const rate = this.rates.get(ip) ?? { count: 0, reset: now + 60000 };
    if (rate.count >= (this.options.rateLimit ?? 6))
      throw new ApiError(
        429,
        "释读请求过于频繁，请稍后重试",
        "RATE_LIMIT",
        Math.ceil((rate.reset - now) / 1000),
      );
    rate.count++;
    this.rates.set(ip, rate);
    const pending = {
      ...record,
      readingStatus: "pending" as const,
      readingError: null,
    };
    this.store.update(pending);
    const promise = (async () => {
      try {
        const reading = await generateReading(record, this.options);
        const ready = {
          ...record,
          readingStatus: "ready" as const,
          reading,
          readingError: null,
        };
        this.store.update(ready);
        return ready;
      } catch (error) {
        this.store.update({
          ...record,
          readingStatus: "failed",
          reading: null,
          readingError: (error as Error).message,
        });
        throw error;
      } finally {
        this.tasks.delete(id);
      }
    })();
    this.tasks.set(id, promise);
    return promise;
  }
  async drain() {
    await Promise.allSettled(this.tasks.values());
  }
}
