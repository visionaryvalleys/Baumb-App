import "server-only";
import { HttpError } from "./http";

const API_URL = "https://api.anthropic.com/v1/messages";
const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

export type Effort = "low" | "medium" | "high";

export const AI_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** The first block is identical on every call, so it is marked for prompt caching (cheaper, faster). */
function systemBlocks(cached: string, extra?: string) {
  const blocks: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[] = [{ type: "text", text: cached, cache_control: { type: "ephemeral" } }];
  if (extra) blocks.push({ type: "text", text: extra });
  return blocks;
}

async function post(body: object, signal: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(), "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok || !RETRYABLE.has(res.status) || attempt >= 2) return res;
    await res.body?.cancel();
    const after = Number(res.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 600 * 2 ** attempt, 4000)));
  }
}

async function failure(res: Response): Promise<HttpError> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  console.error(`[ai] Anthropic ${res.status}: ${body?.error?.message ?? res.statusText}`);
  if (res.status === 401 || res.status === 403) return new HttpError(502, "BAUMB couldn't answer right now.");
  if (res.status === 429 || res.status === 529) return new HttpError(503, "BAUMB is busy right now. Try again in a moment.");
  return new HttpError(502, "BAUMB couldn't answer right now.");
}

/** One request whose answer is guaranteed to match `schema` (structured outputs). */
export async function claudeJson<T>(opts: { system: string; prompt: string; schema: object; maxTokens: number; effort: Effort; timeoutMs: number; image?: { mimeType: string; data: string } }): Promise<T> {
  const res = await post(
    {
      model: AI_MODEL,
      max_tokens: opts.maxTokens,
      system: systemBlocks(opts.system),
      messages: [{
        role: "user",
        content: opts.image
          ? [
              { type: "image", source: { type: "base64", media_type: opts.image.mimeType, data: opts.image.data } },
              { type: "text", text: opts.prompt },
            ]
          : opts.prompt,
      }],
      output_config: { effort: opts.effort, format: { type: "json_schema", schema: opts.schema } },
    },
    AbortSignal.timeout(opts.timeoutMs),
  );
  if (!res.ok) throw await failure(res);
  const data = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  if (data.stop_reason === "max_tokens") throw new HttpError(502, "The answer was cut off.");
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new HttpError(502, "No answer came back.");
  return JSON.parse(text) as T;
}

/** Streams only the answer text. Errors before the first byte become an HttpError; later ones end the stream. */
export async function claudeStream(opts: { system: string; context?: string; messages: ChatMessage[]; maxTokens: number; effort: Effort; signal: AbortSignal; timeoutMs: number }): Promise<ReadableStream<Uint8Array>> {
  const upstream = new AbortController();
  const signal = AbortSignal.any([opts.signal, upstream.signal, AbortSignal.timeout(opts.timeoutMs)]);
  const res = await post(
    {
      model: AI_MODEL,
      max_tokens: opts.maxTokens,
      stream: true,
      system: systemBlocks(opts.system, opts.context),
      messages: opts.messages,
      output_config: { effort: opts.effort },
    },
    signal,
  );
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const cut = buffer.indexOf("\n\n");
          if (cut === -1) {
            const { value, done } = await reader.read();
            if (done) return controller.close();
            buffer += value;
            continue;
          }
          const event = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const data = event
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!data) continue;
          const msg = JSON.parse(data) as { type: string; delta?: { type: string; text?: string }; error?: { message?: string } };
          if (msg.type === "content_block_delta" && msg.delta?.type === "text_delta" && msg.delta.text) {
            controller.enqueue(encoder.encode(msg.delta.text));
            return;
          }
          if (msg.type === "message_stop") return controller.close();
          if (msg.type === "error") {
            console.error(`[ai] stream error: ${msg.error?.message ?? "unknown"}`);
            controller.enqueue(encoder.encode("\n\n_The answer was interrupted. Please ask again._"));
            return controller.close();
          }
        }
      } catch (err) {
        if (!signal.aborted) console.error("[ai] stream failed", err);
        controller.close();
      }
    },
    cancel() {
      upstream.abort();
      void reader.cancel().catch(() => {});
    },
  });
}
