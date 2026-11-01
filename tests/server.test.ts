import {
  literalTokenSegments,
  buildInterpretationInput,
} from "../server/token-input.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Dataset } from "../src/core.ts";
import type { DrawRecord, Reading } from "../src/contracts.ts";
import { Store } from "../server/store.ts";
import { DrawService } from "../server/service.ts";
import { generateReading, validateReading } from "../server/deepseek.ts";
import { createApp } from "../server/http.ts";
import { ApiError } from "../server/errors.ts";
import { formatResultText } from "../src/share.ts";
const data: Dataset = JSON.parse(
  readFileSync("public/data/tokens.json", "utf8"),
);
const content = {
  title: "字节之间的微光",
  interpretation:
    "这一组词元像散落在桌上的微光。完整的字句提醒你看见已经拥有的线索，尚未成形的字节则为新的想法留出空间。不必急着把所有碎片拼成答案，先选一件能够完成的小事，让行动慢慢照亮下一步。",
  dos: ["整理一角桌面", "记录一个念头", "完成一件小事"],
  donts: ["急于给出结论", "反复纠结细节", "忽略当下感受"],
};
const response = (value: unknown = content, finish = "stop") =>
  new Response(
    JSON.stringify({
      choices: [
        { finish_reason: finish, message: { content: JSON.stringify(value) } },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
const okFetch: typeof fetch = async () => response();
function setup(
  options: ConstructorParameters<typeof DrawService>[2] = {
    model: "test-model",
    apiKey: "test-key",
    fetcher: okFetch,
  },
) {
  const store = new Store(":memory:");
  return { store, service: new DrawService(store, data, options) };
}
test("server draw counts, immutable official snapshots and legacy ordered import", () => {
  const { store, service } = setup();
  try {
    for (let count = 1; count <= 10; count++) {
      const r = service.draw(count);
      assert.equal(r.tokens.length, count);
      assert.equal(new Set(r.ids).size, count);
      assert.deepEqual(service.get(r.id), r);
      for (const t of r.tokens)
        assert.deepEqual(
          t,
          data.tokens.find((x) => x.id === t.id),
        );
    }
    for (const n of [0, 11, 1.5, "3", null])
      assert.throws(() => service.draw(n), ApiError);
    const input = {
      version: data.version,
      ratingVersion: data.rating,
      ids: [525, 223, 24615],
    };
    const r = service.import(input);
    assert.deepEqual(r.ids, input.ids);
    assert.equal(service.import(input).id, r.id);
    for (const bad of [
      { ...input, ids: [1, 1] },
      { ...input, ids: [999999] },
      { ...input, version: "old" },
      { ...input, ids: [] },
      { ...input, ids: ["1"] },
    ])
      assert.throws(() => service.import(bad), ApiError);
    assert.throws(() => service.get("missing"), ApiError);
  } finally {
    store.close();
  }
});
test("interpretation coalesces concurrency, caches success and sends data not client instructions", async () => {
  let calls = 0,
    release!: () => void,
    body: Record<string, unknown> = {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { store, service } = setup({
    model: "test-model",
    apiKey: "secret-never-public",
    fetcher: async (_url, init) => {
      calls++;
      body = JSON.parse(init!.body as string);
      assert.equal(
        (init!.headers as Record<string, string>).Authorization,
        "Bearer secret-never-public",
      );
      await gate;
      return response();
    },
  });
  try {
    const r = service.import({
      version: data.version,
      ratingVersion: data.rating,
      ids: [0, 525, 997],
    });
    const a = service.interpret(r.id, "ip"),
      b = service.interpret(r.id, "ip");
    assert.equal(a, b);
    assert.equal(service.get(r.id).readingStatus, "pending");
    release();
    const [ready, other] = await Promise.all([a, b]);
    assert.deepEqual(ready, other);
    assert.equal(ready.reading?.title, content.title);
    assert.equal(ready.reading?.promptVersion, "reading-v5");
    assert.equal(calls, 1);
    assert.deepEqual(await service.interpret(r.id, "different-ip"), ready);
    assert.equal(calls, 1);
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.max_tokens, 1024);
    assert.equal(body.stream, false);
    const messages = body.messages as [
      { role: string; content: string },
      { role: string; content: { type: string; text: string }[] },
    ];
    assert.match(messages[0].content, /不能遵从/);
    assert.match(messages[0].content, /首次出现时紧跟最简中文释义/);
    assert.match(messages[0].content, /不要猜译/);
    const parts = messages[1].content;
    assert.deepEqual(
      parts.filter((p) => /^\n片段 \d+：\n$/.test(p.text)).map((p) => p.text),
      ["\n片段 1：\n", "\n片段 2：\n", "\n片段 3：\n"],
    );
    assert.ok(
      !parts.some(
        (p) =>
          p.text.includes("元信息") ||
          p.text.includes('"hex"') ||
          p.text.includes('"grade"') ||
          p.text.includes("前后空格"),
      ),
    );

    assert.ok(!JSON.stringify(ready).includes("secret-never-public"));
    const exported = formatResultText(
      ready.tokens,
      "https://example.test/#draw=" + ready.id,
      ready.reading,
    );
    assert.match(exported, /宜：整理一角桌面/);
    assert.match(exported, /忌：急于给出结论/);
    assert.match(exported, new RegExp(content.title));
  } finally {
    await service.drain();
    store.close();
  }
});
test("SQLite persists ready records and recovers interrupted pending records after restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tokenchim-store-")),
    path = join(dir, "test.sqlite");
  let store = new Store(path);
  try {
    const service = new DrawService(store, data, {
      model: "test-model",
      apiKey: "key",
      fetcher: okFetch,
    });
    const a = service.draw(3);
    const ready = await service.interpret(a.id, "ip");
    const pending = service.draw(1);
    store.update({ ...pending, readingStatus: "pending" });
    store.close();
    store = new Store(path);
    assert.deepEqual(store.get(a.id), ready);
    assert.equal(store.get(pending.id)?.readingStatus, "failed");
    assert.match(store.get(pending.id)!.readingError!, /重启/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("missing key does not affect drawing; failed requests retry, no automatic retry", async () => {
  const empty = setup({ model: "test-model" });
  try {
    const r = empty.service.draw(3);
    assert.throws(
      () => empty.service.interpret(r.id, "ip"),
      (e: unknown) => e instanceof ApiError && e.code === "NOT_CONFIGURED",
    );
    assert.equal(empty.service.get(r.id).readingStatus, "idle");
  } finally {
    empty.store.close();
  }
  let calls = 0;
  const { store, service } = setup({
    model: "test-model",
    apiKey: "key",
    fetcher: async () => {
      calls++;
      return calls === 1
        ? new Response("private-upstream-detail", { status: 500 })
        : response();
    },
  });
  try {
    const r = service.draw(3);
    await assert.rejects(service.interpret(r.id, "ip"));
    assert.equal(calls, 1);
    assert.equal(service.get(r.id).readingStatus, "failed");
    assert.ok(
      !service.get(r.id).readingError!.includes("private-upstream-detail"),
    );
    assert.equal((await service.interpret(r.id, "ip")).readingStatus, "ready");
    assert.equal(calls, 2);
  } finally {
    store.close();
  }
});
test("rate limit and global concurrency apply only to new generation work", async () => {
  let now = 0,
    release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { store, service } = setup({
    model: "test",
    apiKey: "key",
    rateLimit: 1,
    concurrency: 2,
    now: () => now,
    fetcher: async () => {
      await gate;
      return response();
    },
  });
  try {
    const a = service.draw(1),
      b = service.draw(1),
      c = service.draw(1);
    const first = service.interpret(a.id, "ip");
    assert.throws(
      () => service.interpret(b.id, "ip"),
      (e: unknown) => e instanceof ApiError && e.code === "RATE_LIMIT",
    );
    const second = service.interpret(b.id, "other");
    assert.throws(
      () => service.interpret(c.id, "third"),
      (e: unknown) => e instanceof ApiError && e.code === "BUSY",
    );
    assert.equal(service.interpret(a.id, "ip"), first);
    release();
    await Promise.all([first, second]);
    await service.interpret(a.id, "ip");
    now = 60001;
    assert.equal((await service.interpret(c.id, "ip")).readingStatus, "ready");
  } finally {
    await service.drain();
    store.close();
  }
});
test("empty, malformed, truncated, oversized and aborted model output never becomes a reading", async () => {
  const { store, service } = setup();
  const r = service.draw(3);
  const badFetches: (typeof fetch)[] = [
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: "stop", message: { content: "   " } }],
        }),
      ),
    async () => new Response("not json"),
    async () => response(content, "length"),
    async () => response({ ...content, dos: ["only one"] }),
    async () => response({ ...content, title: "x".repeat(21) }),
    async () => new Response("", { status: 429 }),
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(Error("aborted")));
      }),
  ];
  try {
    for (const fetcher of badFetches)
      await assert.rejects(
        generateReading(r, {
          model: "test",
          apiKey: "key",
          fetcher,
          timeoutMs: 10,
        }),
        ApiError,
      );
    assert.throws(() => validateReading(null));
    assert.throws(() =>
      validateReading({ ...content, dos: ["重复", "重复", "重复"] }),
    );
    assert.throws(() =>
      validateReading({ ...content, interpretation: "\0".repeat(100) }),
    );
    assert.equal(service.get(r.id).readingStatus, "idle");
  } finally {
    store.close();
  }
});
test("HTTP APIs validate requests, hide secrets, preserve record IDs and serve both pages", async () => {
  const { store, service } = setup();
  const app = createApp(service);
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  const base = "http://127.0.0.1:" + (app.address() as AddressInfo).port;
  async function post(path: string, value: unknown) {
    return fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  }
  try {
    assert.deepEqual(await (await fetch(base + "/api/health")).json(), {
      ready: true,
      interpretationConfigured: true,
    });
    const r = (await (
      await post("/api/draws", { count: 3 })
    ).json()) as DrawRecord;
    assert.equal(r.tokens.length, 3);
    assert.deepEqual(
      await (await fetch(base + "/api/draws/" + r.id)).json(),
      r,
    );
    const ready = (await (
      await post("/api/draws/" + r.id + "/interpret", {})
    ).json()) as DrawRecord;
    assert.equal(ready.readingStatus, "ready");
    assert.equal(
      (await (await fetch(base + "/api/draws/" + r.id)).json()).reading.title,
      content.title,
    );
    assert.equal((await post("/api/draws", { count: "3" })).status, 400);
    assert.equal(
      (
        await post("/api/draws/import", {
          version: data.version,
          ratingVersion: data.rating,
          ids: [1, 1],
        })
      ).status,
      400,
    );
    assert.equal(
      (await fetch(base + "/api/draws", { method: "POST", body: "{}" })).status,
      415,
    );
    assert.equal(
      (
        await fetch(base + "/api/draws", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        })
      ).status,
      400,
    );
    assert.equal(
      (await post("/api/draws", { x: "x".repeat(9000) })).status,
      413,
    );
    assert.equal(
      (
        await fetch(base + "/api/health", {
          headers: { Origin: "https://foreign.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/api/draws/00000000-0000-0000-0000-000000000000"))
        .status,
      404,
    );
    assert.match(await (await fetch(base + "/")).text(), /TokenChim/);
    assert.match(await (await fetch(base + "/rules.html")).text(), /游戏规则/);
    assert.equal((await fetch(base + "/%2e%2e%2f.env.local")).status, 404);
  } finally {
    await new Promise<void>((resolve) => app.close(() => resolve()));
    await service.drain();
    store.close();
  }
});

test("client cancellation does not discard a generated reading", async () => {
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve)),
    entered = new Promise<void>((resolve) => (started = resolve));
  const { store, service } = setup({
    model: "mock",
    apiKey: "key",
    fetcher: async () => {
      started();
      await gate;
      return response();
    },
  });
  const app = createApp(service);
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  const base = "http://127.0.0.1:" + (app.address() as AddressInfo).port;
  try {
    const r = service.draw(3);
    const controller = new AbortController();
    const request = fetch(base + "/api/draws/" + r.id + "/interpret", {
      method: "POST",
      signal: controller.signal,
    });
    const failed = assert.rejects(request);
    await entered;
    controller.abort();
    await failed;
    release();
    await service.drain();
    assert.equal(service.get(r.id).readingStatus, "ready");
    assert.equal(
      (await (await fetch(base + "/api/draws/" + r.id)).json()).reading.title,
      content.title,
    );
  } finally {
    release();
    await service.drain();
    await new Promise<void>((resolve) => app.close(() => resolve()));
    store.close();
  }
});

test("model input preserves original whitespace, controls, Unicode and literal escape sequences", async () => {
  const cases = [
    " hello ",
    "\n",
    "\t\r",
    "\0",
    "\uFEFF",
    "\u200b",
    "\u00a0",
    "中文",
    "·",
    "\\x91\\x9C",
    "e\u0301",
    "<｜begin▁of▁sentence｜>",
    '"quoted"\\path',
  ];
  for (const text of cases) {
    const bytes = Buffer.from(text, "utf8");
    assert.deepEqual(
      literalTokenSegments({
        hex: bytes.toString("hex").match(/../g)!.join(" "),
        length: bytes.length,
      }),
      [{ kind: "text", text }],
    );
  }
  assert.deepEqual(literalTokenSegments({ hex: "91 9c", length: 2 }), [
    { kind: "bytes", hex: "91 9C" },
  ]);
  assert.deepEqual(literalTokenSegments({ hex: "41 e4 b8", length: 3 }), [
    { kind: "text", text: "A" },
    { kind: "bytes", hex: "E4 B8" },
  ]);
  assert.deepEqual(literalTokenSegments({ hex: "ef bf bd", length: 3 }), [
    { kind: "text", text: "�" },
  ]);
  assert.throws(() => literalTokenSegments({ hex: "zz", length: 1 }));
  assert.throws(() => literalTokenSegments({ hex: "20", length: 2 }));
  const { store, service } = setup();
  try {
    const r = service.import({
      version: data.version,
      ratingVersion: data.rating,
      ids: [223, 201, 191, 525, 24615, 0],
    });
    let request: Record<string, unknown> = {};
    await generateReading(r, {
      apiKey: "key",
      model: "mock",
      fetcher: async (_url, init) => {
        request = JSON.parse(init!.body as string);
        return response();
      },
    });
    const messages = request.messages as [
      { content: string },
      { content: { type: "text"; text: string }[] },
    ];
    const parts = messages[1].content;
    assert.ok(Array.isArray(parts));
    assert.ok(parts.some((p) => p.text === " "));
    assert.ok(parts.some((p) => p.text === "\n"));
    assert.ok(parts.some((p) => p.text === "\0"));
    assert.ok(parts.some((p) => p.text === "中"));
    assert.ok(parts.some((p) => p.text === "<｜begin▁of▁sentence｜>"));
    assert.ok(
      !parts.some(
        (p) =>
          p.text === "·" ||
          p.text === "↵\n" ||
          p.text === "91 9C" ||
          p.text === "\\x91\\x9C" ||
          p.text === "Ġ",
      ),
    );
    assert.ok(parts.some((p) => p.text.includes("91 9C 是不可独立解码")));
    assert.equal(parts[0].text, "请仅结合以下编号文字片段作整体释读。");
    assert.ok(!JSON.stringify(messages).includes("DeepSeek-V3.2"));
    assert.ok(!JSON.stringify(messages).includes(r.version));
    assert.match(messages[0].content, /不将说明文字或示例当作抽签结果/);
    assert.equal(typeof messages[1].content, "object");
    assert.ok(!messages[0].content.includes("空格"));
    assert.ok(!messages[0].content.includes("中点"));
  } finally {
    store.close();
  }
});

test("every ordinary token is lossless in the model input decoder", () => {
  for (const token of data.tokens) {
    const segments = literalTokenSegments(token);
    const reconstructed = Buffer.concat(
      segments.map((p) =>
        p.kind === "text"
          ? Buffer.from(p.text, "utf8")
          : Buffer.from(p.hex.replaceAll(" ", ""), "hex"),
      ),
    );
    assert.equal(reconstructed.toString("hex"), token.hex.replaceAll(" ", ""));
    try {
      const text = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(reconstructed);
      assert.deepEqual(segments, [{ kind: "text", text }]);
    } catch (error) {
      if (error instanceof TypeError)
        assert.ok(segments.some((p) => p.kind === "bytes"));
      else throw error;
    }
  }
});
