import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiJson, geminiStream } from "./gemini";

vi.mock("server-only", () => ({}));
process.env.GEMINI_API_KEY = "test-key";

afterEach(() => vi.unstubAllGlobals());

function sse(events: object[], chunkSize = 7): ReadableStream<Uint8Array> {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join("");
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

const part = (text: string, finishReason?: string) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] });
const json = { system: "s", prompt: "p", schema: { type: "object" }, maxTokens: 100, effort: "medium" as const, timeoutMs: 5_000 };
const chat = { system: "s", messages: [{ role: "user" as const, content: "q" }, { role: "assistant" as const, content: "a" }, { role: "user" as const, content: "q2" }], maxTokens: 100, effort: "low" as const, signal: new AbortController().signal, timeoutMs: 5_000 };

describe("geminiJson", () => {
  it("asks for JSON matching the schema and ignores thought parts", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text: '{"items":[{"key":"idli"}]}' }] }, finishReason: "STOP" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await geminiJson<{ items: { key: string }[] }>(json);
    expect(out.items[0].key).toBe("idli");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/:generateContent$/);
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: { type: "object" }, thinkingConfig: { thinkingLevel: "medium" } });
    expect(body.systemInstruction).toEqual({ parts: [{ text: "s" }] });
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("retries a rate limit, then gives a plain message", async () => {
    const busy = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: { code: 429 } }, { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(Response.json(part("{}", "STOP")));
    vi.stubGlobal("fetch", busy);
    await expect(geminiJson(json)).resolves.toEqual({});
    expect(busy).toHaveBeenCalledTimes(2);

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "API key not valid" } }, { status: 400 })));
    await expect(geminiJson(json)).rejects.toThrow("couldn't answer");
  });

  it("fails clearly when the answer was cut off", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(part('{"items":[', "MAX_TOKENS"))));
    await expect(geminiJson(json)).rejects.toThrow("cut off");
  });
});

describe("geminiStream", () => {
  it("streams the answer however the bytes are split, with assistant turns sent as the model", async () => {
    const fetchMock = vi.fn(async () => new Response(sse([part("Eat **165 g** "), part("protein — ¾ katori dal.", "STOP")]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const stream = await geminiStream({ ...chat, context: "User data" });
    expect(await readAll(stream)).toBe("Eat **165 g** protein — ¾ katori dal.");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/:streamGenerateContent\?alt=sse$/);
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts).toEqual([{ text: "s" }, { text: "User data" }]);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
  });

  it("marks an answer that ran out of room", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse([part("Eat more", "MAX_TOKENS")]), { status: 200 })));
    expect(await readAll(await geminiStream(chat))).toBe("Eat more…");
  });

  it("reports a failure before any text as an error, and keeps text already streamed when it breaks later", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse([{ error: { code: 429, message: "quota" } }]), { status: 200 })));
    await expect(geminiStream(chat)).rejects.toThrow("busy");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse([part("Eat more dal"), { error: { code: 500, message: "boom" } }]), { status: 200 })));
    expect(await readAll(await geminiStream(chat))).toBe("Eat more dal\n\n_The answer was interrupted. Please ask again._");
  });
});
