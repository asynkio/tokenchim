import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DrawRecord } from "../src/contracts.ts";
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS draws (id TEXT PRIMARY KEY, import_key TEXT UNIQUE, payload TEXT NOT NULL);
      PRAGMA user_version=1;`);
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
  close() {
    this.db.close();
  }
}
