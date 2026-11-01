import type { Token } from "./core";
export interface Reading {
  title: string;
  interpretation: string;
  dos: string[];
  donts: string[];
  model: string;
  promptVersion: string;
  createdAt: string;
}
export interface DrawRecord {
  id: string;
  createdAt: string;
  version: string;
  ratingVersion: string;
  source: "random" | "legacy";
  ids: number[];
  tokens: Token[];
  readingStatus: "idle" | "pending" | "ready" | "failed";
  reading: Reading | null;
  readingError: string | null;
}
export interface Health {
  ready: boolean;
  interpretationConfigured: boolean;
}
