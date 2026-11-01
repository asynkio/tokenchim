import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const revision = "a7e62ac04ecb2c0a54d736dc46601c5606cf10a6";
export const sha256 =
  "cd050be35cae877f8f0aa847f45aa87e23835a56ca32b29b28545597852784e5";
const matches = (bytes) =>
  createHash("sha256").update(bytes).digest("hex") === sha256;

export async function downloadVocabulary({ root = ".", fetcher = fetch } = {}) {
  const directory = resolve(root, "vendor");
  await mkdir(directory, { recursive: true });
  for (const name of ["tokenizer.json", "LICENSE"]) {
    const target = resolve(directory, name);
    try {
      const bytes = await readFile(target);
      if (name === "tokenizer.json" ? matches(bytes) : bytes.length > 0) {
        console.log(`${name}: using verified local file`);
        continue;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const temporary = `${target}.${process.pid}.tmp`;
    try {
      const response = await fetcher(
        `https://huggingface.co/deepseek-ai/DeepSeek-V3.2/resolve/${revision}/${name}`,
        { signal: AbortSignal.timeout(120000) },
      );
      if (!response.ok) throw Error(`${name}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (name === "tokenizer.json" && !matches(bytes))
        throw Error("Pinned tokenizer SHA-256 mismatch");
      if (!bytes.length) throw Error(`${name}: empty download`);
      await writeFile(temporary, bytes);
      await rename(temporary, target);
      console.log(`${name}: downloaded`);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  downloadVocabulary().catch((error) => {
    console.error(`Vocabulary preparation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
