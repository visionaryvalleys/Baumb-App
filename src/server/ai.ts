import "server-only";
import { AI_MODEL as CLAUDE_MODEL, type ChatMessage, type Effort, claudeJson, claudeStream } from "./anthropic";
import { OPENAI_MODEL, openaiJson, openaiStream } from "./openai";

export type { ChatMessage, Effort };
export type AiProvider = "openai" | "anthropic";

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

/** OpenAI when its key is set (or AI_PROVIDER=openai), otherwise Anthropic, otherwise none. */
export function aiProvider(): AiProvider | null {
  const openai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (preferred === "anthropic" && anthropic) return "anthropic";
  if (preferred === "openai" && openai) return "openai";
  return openai ? "openai" : anthropic ? "anthropic" : null;
}

export const aiEnabled = () => aiProvider() !== null;

export function aiModel(): string {
  return aiProvider() === "anthropic" ? CLAUDE_MODEL : OPENAI_MODEL;
}

export function aiJson<T>(opts: AiJsonOptions): Promise<T> {
  return aiProvider() === "anthropic" ? claudeJson<T>(opts) : openaiJson<T>(opts);
}

export function aiStream(opts: AiStreamOptions): Promise<ReadableStream<Uint8Array>> {
  return aiProvider() === "anthropic" ? claudeStream(opts) : openaiStream(opts);
}
