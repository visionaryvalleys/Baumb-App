import { afterEach, describe, expect, it, vi } from "vitest";
import { openaiJson, openaiStream } from "./openai";

vi.mock("server-only", () => ({}));
process.env.OPENAI_API_KEY = "test-key";

afterEach(() => vi.unstubAllGlobals());

function sse(events: object[], chunkSize = 7): ReadableStream<Uint8Array> {
  const text = events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i >= bytes.length) return c.close();
      c.enqueue(bytes.slice(i, (i += chunkSize)));
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>) {
  let out = "";
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return out + decoder.decode();
    out += decoder.decode(value, { stream: true });
  }
}

const json = { system: "s", prompt: "p", schema: { type: "object" }, maxTokens: 100, effort: "medium" as const, timeoutMs: 5_000 };
const chat = { system: "s", messages: [{ role: "user" as const, content: "q" }], maxTokens: 100, effort: "low" as const, signal: new AbortController().signal, timeoutMs: 5_000 };

describe("openaiJson", () => {
  it("asks for strict JSON matching the schema and skips reasoning items", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ status: "completed", output: [{ type: "reasoning", summary: [] }, { type: "message", content: [{ type: "output_text", text: '{"items":[{"key":"idli"}]}' }] }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await openaiJson<{ items: { key: string }[] }>({ ...json, cacheKey: "baumb-food" });
    expect(out.items[0].key).toBe("idli");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.text.format).toEqual({ type: "json_schema", name: "answer", schema: { type: "object" }, strict: true });
    expect(body).toMatchObject({ instructions: "s", reasoning: { effort: "medium" }, prompt_cache_key: "baumb-food", store: false });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
  });

  it("retries a rate limit but not an empty account", async () => {
    const busy = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: { code: "rate_limit_exceeded" } }, { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] }));
    vi.stubGlobal("fetch", busy);
    await expect(openaiJson(json)).resolves.toEqual({});
    expect(busy).toHaveBeenCalledTimes(2);

    const broke = vi.fn(async () => Response.json({ error: { code: "insufficient_quota", message: "quota" } }, { status: 429 }));
    vi.stubGlobal("fetch", broke);
    await expect(openaiJson(json)).rejects.toThrow("no credit");
    expect(broke).toHaveBeenCalledTimes(1);
  });

  it("fails clearly when the answer was cut off", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] })));
    await expect(openaiJson(json)).rejects.toThrow("cut off");
  });
});

describe("openaiStream", () => {
  it("streams only answer text, however the bytes are split, with the user's data after the fixed instructions", async () => {
    const events = [
      { type: "response.created", response: {} },
      { type: "response.output_item.added", item: { type: "reasoning" } },
      { type: "response.output_text.delta", delta: "Eat **165 g** " },
      { type: "response.output_text.delta", delta: "protein — ¾ katori dal." },
      { type: "response.completed", response: {} },
    ];
    const fetchMock = vi.fn(async () => new Response(sse(events), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const stream = await openaiStream({ ...chat, context: "User data" });
    expect(await readAll(stream)).toBe("Eat **165 g** protein — ¾ katori dal.");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.instructions).toBe("s");
    expect(body.input).toEqual([{ role: "developer", content: "User data" }, { role: "user", content: "q" }]);
  });

  it("reports a failure that arrives before any text as an error, not a broken answer", async () => {
    const events = [
      { type: "response.created", response: {} },
      { type: "error", error: { code: "insufficient_quota", message: "You have no credits remaining." } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse(events), { status: 200 })));
    await expect(openaiStream(chat)).rejects.toThrow("no credit");
  });

  it("keeps the text already streamed when the answer breaks later", async () => {
    const events = [
      { type: "response.output_text.delta", delta: "Eat more dal" },
      { type: "response.failed", response: { error: { code: "server_error", message: "boom" } } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse(events), { status: 200 })));
    expect(await readAll(await openaiStream(chat))).toBe("Eat more dal\n\n_The answer was interrupted. Please ask again._");
  });

  it("explains a rejected key before streaming starts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Incorrect API key" } }, { status: 401 })));
    await expect(openaiStream(chat)).rejects.toThrow("OPENAI_API_KEY");
  });
});
