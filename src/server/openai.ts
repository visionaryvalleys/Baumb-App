import "server-only";
import type { AiJsonOptions, AiStreamOptions } from "./ai";
import { HttpError } from "./http";

const API_URL = "https://api.openai.com/v1/responses";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-6.1-sol";

async function post(body: object, signal: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}` },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok || !RETRYABLE.has(res.status) || attempt >= 2) return res;
    // An empty account stays empty: retrying only delays the message.
    if (res.status === 429 && (await res.clone().text()).includes("insufficient_quota")) return res;
    await res.body?.cancel();
    const after = Number(res.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 600 * 2 ** attempt, 4000)));
  }
}

async function failure(res: Response): Promise<HttpError> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
  console.error(`[ai] OpenAI ${res.status}: ${body?.error?.message ?? res.statusText}`);
  if (res.status === 401 || res.status === 403) return new HttpError(502, "BAUMB couldn't answer right now.");
  if (body?.error?.code === "insufficient_quota") return new HttpError(503, "BAUMB couldn't answer right now.");
  if (res.status === 429) return new HttpError(503, "BAUMB is busy right now. Try again in a moment.");
  return new HttpError(502, "BAUMB couldn't answer right now.");
}

interface OutputItem {
  type: string;
  content?: { type: string; text?: string; refusal?: string }[];
}

/** One request whose answer is guaranteed to match `schema` (strict structured outputs). */
export async function openaiJson<T>(opts: AiJsonOptions): Promise<T> {
  const res = await post(
    {
      model: OPENAI_MODEL,
      instructions: opts.system,
      input: [{ role: "user", content: opts.prompt }],
      max_output_tokens: opts.maxTokens,
      reasoning: { effort: opts.effort },
      text: { format: { type: "json_schema", name: "answer", schema: opts.schema, strict: true } },
      prompt_cache_key: opts.cacheKey,
      store: false,
    },
    AbortSignal.timeout(opts.timeoutMs),
  );
  if (!res.ok) throw await failure(res);
  const data = (await res.json()) as { status?: string; incomplete_details?: { reason?: string }; output?: OutputItem[] };
  if (data.status === "incomplete") throw new HttpError(502, data.incomplete_details?.reason === "max_output_tokens" ? "The answer was cut off." : "The answer was incomplete.");
  const parts = data.output?.find((o) => o.type === "message")?.content ?? [];
  if (parts.some((p) => p.type === "refusal")) throw new HttpError(502, "No answer came back.");
  const text = parts.find((p) => p.type === "output_text")?.text;
  if (!text) throw new HttpError(502, "No answer came back.");
  return JSON.parse(text) as T;
}

/** Streams only the answer text. Errors before the first byte become an HttpError; later ones end the stream. */
export async function openaiStream(opts: AiStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const upstream = new AbortController();
  const signal = AbortSignal.any([opts.signal, upstream.signal, AbortSignal.timeout(opts.timeoutMs)]);
  const res = await post(
    {
      model: OPENAI_MODEL,
      // The fixed instructions come first so every request shares a cacheable prefix; the user's data follows.
      instructions: opts.system,
      input: [...(opts.context ? [{ role: "developer", content: opts.context }] : []), ...opts.messages],
      max_output_tokens: opts.maxTokens,
      reasoning: { effort: opts.effort },
      prompt_cache_key: opts.cacheKey,
      store: false,
      stream: true,
    },
    signal,
  );
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const encoder = new TextEncoder();
  let buffer = "";

  /** The next piece of answer text, "" for a non-text event, or null when the answer is over. */
  async function next(): Promise<string | null> {
    for (;;) {
      const cut = buffer.indexOf("\n\n");
      if (cut === -1) {
        const { value, done } = await reader.read();
        if (done) return null;
        buffer += value.replace(/\r\n/g, "\n");
        continue;
      }
      const event = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = event
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;
      const msg = JSON.parse(data) as StreamEvent;
      if (msg.type === "response.output_text.delta") return msg.delta ?? "";
      if (msg.type === "response.completed") return null;
      if (msg.type === "response.incomplete") throw new StreamEnd(msg.response?.incomplete_details?.reason === "max_output_tokens" ? "…" : "");
      if (msg.type === "response.failed" || msg.type === "error") throw streamError(msg, data);
      return "";
    }
  }

  // Wait for the first text so a failure that arrives before any answer (e.g. no credit) is reported like any other error.
  let first: string | null = "";
  try {
    while (first === "") first = await next();
  } catch (err) {
    void reader.cancel().catch(() => {});
    if (err instanceof StreamEnd) first = err.tail || null;
    else throw err;
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
        if (err instanceof StreamEnd) controller.enqueue(encoder.encode(err.tail));
        else if (!signal.aborted) controller.enqueue(encoder.encode("\n\n_The answer was interrupted. Please ask again._"));
        if (!(err instanceof StreamEnd || err instanceof HttpError) && !signal.aborted) console.error("[ai] stream failed", err);
        controller.close();
      }
    },
    cancel() {
      upstream.abort();
      void reader.cancel().catch(() => {});
    },
  });
}

interface StreamEvent {
  type: string;
  delta?: string;
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
  response?: { incomplete_details?: { reason?: string }; error?: { code?: string; message?: string } };
}

class StreamEnd extends Error {
  constructor(readonly tail: string) {
    super("stream ended");
  }
}

function streamError(msg: StreamEvent, raw: string): HttpError {
  const err = msg.error ?? msg.response?.error ?? msg;
  console.error(`[ai] OpenAI stream error: ${err.message ?? raw.slice(0, 500)}`);
  if (err.code === "insufficient_quota" || /no credits|quota/i.test(err.message ?? "")) return new HttpError(503, "BAUMB couldn't answer right now.");
  if (err.code === "rate_limit_exceeded") return new HttpError(503, "BAUMB is busy right now. Try again in a moment.");
  return new HttpError(502, "BAUMB couldn't answer right now.");
}
