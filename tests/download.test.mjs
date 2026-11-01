import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadVocabulary, revision } from "../scripts/download.mjs";

const source = await readFile("vendor/tokenizer.json");
const license = await readFile("vendor/LICENSE");
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "tokenchim-download-"));
  try {
    await mkdir(join(root, "vendor"));
    await run(root, join(root, "vendor"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("fresh download pins revision and writes exact source and license", async () => {
  await fixture(async (root, directory) => {
    const urls = [];
    await downloadVocabulary({
      root,
      fetcher: async (url, options) => {
        urls.push(url);
        assert.ok(options.signal instanceof AbortSignal);
        return new Response(url.endsWith("/LICENSE") ? license : source);
      },
    });
    assert.deepEqual(
      urls,
      ["tokenizer.json", "LICENSE"].map(
        (name) =>
          `https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/resolve/${revision}/${name}`,
      ),
    );
    assert.deepEqual(await readFile(join(directory, "tokenizer.json")), source);
    assert.deepEqual(await readFile(join(directory, "LICENSE")), license);
    assert.ok(
      !(await readdir(directory)).some((name) => name.endsWith(".tmp")),
    );
  });
});

test("verified cache needs no network and corrupt cache is replaced", async () => {
  await fixture(async (root, directory) => {
    await writeFile(join(directory, "tokenizer.json"), source);
    await writeFile(join(directory, "LICENSE"), license);
    await downloadVocabulary({
      root,
      fetcher: () => assert.fail("Unexpected network request"),
    });
    await writeFile(join(directory, "tokenizer.json"), "corrupt");
    let calls = 0;
    await downloadVocabulary({
      root,
      fetcher: async () => {
        calls++;
        return new Response(source);
      },
    });
    assert.equal(calls, 1);
    assert.deepEqual(await readFile(join(directory, "tokenizer.json")), source);
  });
});

test("invalid hash and HTTP errors do not overwrite existing files", async () => {
  await fixture(async (root, directory) => {
    const target = join(directory, "tokenizer.json");
    await writeFile(target, "existing corrupt cache");
    for (const [response, error] of [
      [new Response("wrong vocabulary"), /SHA-256 mismatch/],
      [new Response("unavailable", { status: 503 }), /HTTP 503/],
    ]) {
      await assert.rejects(
        downloadVocabulary({ root, fetcher: async () => response }),
        error,
      );
      assert.equal(await readFile(target, "utf8"), "existing corrupt cache");
      assert.deepEqual(await readdir(directory), ["tokenizer.json"]);
    }
  });
});

test("network failure leaves no partial download", async () => {
  await fixture(async (root, directory) => {
    await assert.rejects(
      downloadVocabulary({
        root,
        fetcher: async () => {
          throw Error("Network unavailable");
        },
      }),
      /Network unavailable/,
    );
    assert.deepEqual(await readdir(directory), []);
  });
});
