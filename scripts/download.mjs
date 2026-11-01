import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export const revision = "a7e62ac04ecb2c0a54d736dc46601c5606cf10a6";
await mkdir("vendor", { recursive: true });
for (const name of ["tokenizer.json", "LICENSE"]) {
  const r = await fetch(
    `https://huggingface.co/deepseek-ai/DeepSeek-V3.2/resolve/${revision}/${name}`,
  );
  if (!r.ok) throw Error(`${name}: ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (
    name === "tokenizer.json" &&
    createHash("sha256").update(bytes).digest("hex") !==
      "cd050be35cae877f8f0aa847f45aa87e23835a56ca32b29b28545597852784e5"
  )
    throw Error("Pinned tokenizer SHA-256 mismatch");
  await writeFile(`vendor/${name}`, bytes);
}
