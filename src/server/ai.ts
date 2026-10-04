import "server-only";
import { AI_MODEL as CLAUDE_MODEL, type ChatMessage, type Effort, claudeJson, claudeStream } from "./anthropic";
import { GEMINI_MODEL, geminiJson, geminiStream } from "./gemini";
import { OPENAI_MODEL, openaiJson, openaiStream } from "./openai";

export type { ChatMessage, Effort };
export type AiProvider = "gemini" | "openai" | "anthropic";

export interface AiJsonOptions {
  system: string;
  prompt: string;
  schema: object;
  maxTokens: number;
  effort: Effort;
  timeoutMs: number;
  cacheKey?: string;
}

export interface AiStreamOptions {
  system: string;
  context?: string;
  messages: ChatMessage[];
  maxTokens: number;
  effort: Effort;
  signal: AbortSignal;
  timeoutMs: number;
  cacheKey?: string;
}

function effort(value: string | undefined, fallback: Effort): Effort {
  return value === "low" || value === "medium" || value === "high" ? value : fallback;
}
export const FOOD_EFFORT = effort(process.env.AI_FOOD_EFFORT ?? process.env.ANTHROPIC_FOOD_EFFORT, "medium");
export const CHAT_EFFORT = effort(process.env.AI_CHAT_EFFORT ?? process.env.ANTHROPIC_CHAT_EFFORT, "low");

const KEYS: Record<AiProvider, string> = { gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
const ORDER: AiProvider[] = ["gemini", "openai", "anthropic"];

/** AI_PROVIDER when its key is set, otherwise the first provider with a key (Gemini, OpenAI, Anthropic), otherwise none. */
export function aiProvider(): AiProvider | null {
  const has = (p: AiProvider) => Boolean(process.env[KEYS[p]]?.trim());
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase() as AiProvider | undefined;
  if (preferred && ORDER.includes(preferred) && has(preferred)) return preferred;
  return ORDER.find(has) ?? null;
}

export const aiEnabled = () => aiProvider() !== null;

export function aiModel(): string {
  return { gemini: GEMINI_MODEL, openai: OPENAI_MODEL, anthropic: CLAUDE_MODEL, none: "" }[aiProvider() ?? "none"];
}

export function aiJson<T>(opts: AiJsonOptions): Promise<T> {
  const p = aiProvider();
  return p === "anthropic" ? claudeJson<T>(opts) : p === "openai" ? openaiJson<T>(opts) : geminiJson<T>(opts);
}

export function aiStream(opts: AiStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const p = aiProvider();
  return p === "anthropic" ? claudeStream(opts) : p === "openai" ? openaiStream(opts) : geminiStream(opts);
}
