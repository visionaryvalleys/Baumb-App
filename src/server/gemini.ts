import "server-only";
import type { AiJsonOptions, AiStreamOptions } from "./ai";
import { HttpError } from "./http";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

async function post(action: string, body: object, signal: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_BASE}/${GEMINI_MODEL}:${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY!.trim() },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok || !RETRYABLE.has(res.status) || attempt >= 2) return res;
    await res.body?.cancel();
    const after = Number(res.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 800 * 2 ** attempt, 4000)));
  }
}

async function failure(res: Response): Promise<HttpError> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; status?: string } } | null;
  console.error(`[ai] Gemini ${res.status}: ${body?.error?.message ?? res.statusText}`);
  if (res.status === 400 && /api key/i.test(body?.error?.message ?? "")) return new HttpError(502, "BAUMB couldn't answer right now.");
  if (res.status === 401 || res.status === 403) return new HttpError(502, "BAUMB couldn't answer right now.");
  if (res.status === 429) return new HttpError(503, "BAUMB is busy right now. Try again in a minute.");
  return new HttpError(502, "BAUMB couldn't answer right now.");
}

interface Candidate {
  content?: { parts?: { text?: string; thought?: boolean }[] };
  finishReason?: string;
}

const textOf = (c: Candidate | undefined) =>
  (c?.content?.parts ?? [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("");

/** One request whose answer is guaranteed to match `schema` (structured output). */
export async function geminiJson<T>(opts: AiJsonOptions): Promise<T> {
  const res = await post(
    "generateContent",
    {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: opts.schema, maxOutputTokens: opts.maxTokens, thinkingConfig: { thinkingLevel: opts.effort } },
    },
    AbortSignal.timeout(opts.timeoutMs),
  );
  if (!res.ok) throw await failure(res);
  const data = (await res.json()) as { candidates?: Candidate[] };
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") throw new HttpError(502, "The answer was cut off.");
  const text = textOf(candidate);
  if (!text) throw new HttpError(502, "No answer came back.");
  return JSON.parse(text) as T;
}

/** Streams only the answer text. Errors before the first text become an HttpError; later ones end the stream. */
export async function geminiStream(opts: AiStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const upstream = new AbortController();
  const signal = AbortSignal.any([opts.signal, upstream.signal, AbortSignal.timeout(opts.timeoutMs)]);
  const res = await post(
    "streamGenerateContent?alt=sse",
    {
      // The fixed instructions come first so requests share a cacheable prefix; the user's data follows.
      systemInstruction: { parts: [{ text: opts.system }, ...(opts.context ? [{ text: opts.context }] : [])] },
      contents: opts.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: opts.maxTokens, thinkingConfig: { thinkingLevel: opts.effort } },
    },
    signal,
  );
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const encoder = new TextEncoder();
  let buffer = "";
  let ended = false;

  /** The next piece of answer text, "" for an event without text, or null when the answer is over. */
  async function next(): Promise<string | null> {
    if (ended) return null;
    for (;;) {
      const cut = buffer.indexOf("\n\n");
      if (cut === -1) {
        const { value, done } = await reader.read();
        if (done) return null;
        buffer = (buffer + value).replace(/\r\n/g, "\n");
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
      const msg = JSON.parse(data) as { candidates?: Candidate[]; error?: { code?: number; message?: string } };
      if (msg.error) {
        console.error(`[ai] Gemini stream error: ${msg.error.message ?? data.slice(0, 500)}`);
        throw new HttpError(msg.error.code === 429 ? 503 : 502, msg.error.code === 429 ? "BAUMB is busy right now. Try again in a minute." : "BAUMB couldn't answer right now.");
      }
      const candidate = msg.candidates?.[0];
      const text = textOf(candidate);
      if (candidate?.finishReason) {
        ended = true;
        return text + (candidate.finishReason === "MAX_TOKENS" ? "…" : "") || null;
      }
      return text;
    }
  }

  // Wait for the first text so a failure before any answer is reported like any other error.
  let first: string | null = "";
  try {
    while (first === "") first = await next();
  } catch (err) {
    void reader.cancel().catch(() => {});
    throw err;
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (first == null) controller.close();
      else controller.enqueue(encoder.encode(first));
    },
    async pull(controller) {
      try {
        let text: string | null = "";
        while (text === "") text = await next();
        if (text == null) controller.close();
        else controller.enqueue(encoder.encode(text));
      } catch (err) {
        if (!signal.aborted) {
          if (!(err instanceof HttpError)) console.error("[ai] stream failed", err);
          controller.enqueue(encoder.encode("\n\n_The answer was interrupted. Please ask again._"));
        }
        controller.close();
      }
    },
    cancel() {
      upstream.abort();
      void reader.cancel().catch(() => {});
    },
  });
}
