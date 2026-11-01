import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ApiError } from "./errors.ts";
import { readingDay } from "./limits.ts";
import type { DrawRecord } from "../src/contracts.ts";
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS draws (id TEXT PRIMARY KEY, import_key TEXT UNIQUE, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reading_usage (day TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK(count >= 0));
      PRAGMA user_version=2;`);
    this.db
      .prepare(
        `UPDATE draws SET payload=json_set(payload, '$.readingStatus', 'failed', '$.readingError', '服务已重启，请重试释读') WHERE json_extract(payload, '$.readingStatus')='pending'`,
      )
      .run();
  }
  get(id: string): DrawRecord | null {
    const row = this.db
      .prepare("SELECT payload FROM draws WHERE id=?")
      .get(id) as { payload: string } | undefined;
    return row ? JSON.parse(row.payload) : null;
  }
  imported(key: string): DrawRecord | null {
    const row = this.db
      .prepare("SELECT payload FROM draws WHERE import_key=?")
      .get(key) as { payload: string } | undefined;
    return row ? JSON.parse(row.payload) : null;
  }
  insert(record: DrawRecord, importKey: string | null = null) {
    this.db
      .prepare("INSERT INTO draws(id,import_key,payload) VALUES(?,?,?)")
      .run(record.id, importKey, JSON.stringify(record));
  }
  update(record: DrawRecord) {
    this.db
      .prepare("UPDATE draws SET payload=? WHERE id=?")
      .run(JSON.stringify(record), record.id);
  }
  reserveReading(record: DrawRecord, now: number, limit: number) {
    const day = readingDay(now);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare("SELECT count FROM reading_usage WHERE day=?")
        .get(day.key) as { count: number } | undefined;
      if ((row?.count ?? 0) >= limit)
        throw new ApiError(
          429,
          "今日释读额度已用完",
          "DAILY_READING_LIMIT",
          day.retryAfter,
        );
      this.db
        .prepare(
          "INSERT INTO reading_usage(day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count=count+1",
        )
        .run(day.key);
      const updated = this.db
        .prepare("UPDATE draws SET payload=? WHERE id=?")
        .run(JSON.stringify(record), record.id);
      if (updated.changes !== 1) throw Error("Reading record disappeared");
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
