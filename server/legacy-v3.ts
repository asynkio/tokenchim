import type { Token } from "../src/core.ts";

// V3.2 and V4.1 share the same base vocabulary; seven added texts and one special flag changed.
export const legacyV3 = {
  version: "ds-v3.2-a7e62ac",
  source:
    "https://huggingface.co/deepseek-ai/DeepSeek-V3.2/resolve/a7e62ac04ecb2c0a54d736dc46601c5606cf10a6/tokenizer.json",
  maxId: 128814,
  overrides: [
    {
      id: 128805,
      raw: "<|EOT|>",
      text: "<|EOT|>",
      hex: "3c 7c 45 4f 54 7c 3e",
      length: 7,
      special: true,
      type: "控制标记",
      grade: "UR",
    },
    {
      id: 128793,
      raw: "｜DSML｜",
      text: "｜DSML｜",
      hex: "ef bd 9c 44 53 4d 4c ef bd 9c",
      length: 10,
      special: true,
      type: "控制标记",
      grade: "UR",
    },
    {
      id: 128794,
      raw: "<dsml:",
      text: "<dsml:",
      hex: "3c 64 73 6d 6c 3a",
      length: 6,
      special: false,
      type: "控制标记",
      grade: "UR",
    },
    {
      id: 128795,
      raw: "</dsml:",
      text: "</dsml:",
      hex: "3c 2f 64 73 6d 6c 3a",
      length: 7,
      special: false,
      type: "控制标记",
      grade: "UR",
    },
    {
      id: 128796,
      raw: "<｜search▁begin｜>",
      text: "<｜search▁begin｜>",
      hex: "3c ef bd 9c 73 65 61 72 63 68 e2 96 81 62 65 67 69 6e ef bd 9c 3e",
      length: 22,
      special: false,
      type: "控制标记",
      grade: "UR",
    },
    {
      id: 128797,
      raw: "<｜search▁end｜>",
      text: "<｜search▁end｜>",
      hex: "3c ef bd 9c 73 65 61 72 63 68 e2 96 81 65 6e 64 ef bd 9c 3e",
      length: 20,
      special: false,
      type: "控制标记",
      grade: "UR",
    },
    {
      id: 128798,
      raw: "<think>",
      text: "<think>",
      hex: "3c 74 68 69 6e 6b 3e",
      length: 7,
      special: false,
      type: "控制标记",
      grade: "UR",
    },
    {
      id: 128799,
      raw: "</think>",
      text: "</think>",
      hex: "3c 2f 74 68 69 6e 6b 3e",
      length: 8,
      special: false,
      type: "控制标记",
      grade: "UR",
    },
  ],
} satisfies {
  version: string;
  source: string;
  maxId: number;
  overrides: Token[];
};
