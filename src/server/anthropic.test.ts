import { afterEach, describe, expect, it, vi } from "vitest";
import { claudeJson, claudeStream } from "./anthropic";

vi.mock("server-only", () => ({}));
process.env.ANTHROPIC_API_KEY = "test-key";

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

describe("claudeJson", () => {
  it("sends the schema and effort, and returns the parsed answer (skipping thinking)", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ content: [{ type: "thinking", thinking: "…" }, { type: "text", text: '{"items":[{"key":"idli"}]}' }], stop_reason: "end_turn" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await claudeJson<{ items: { key: string }[] }>({ system: "s", prompt: "p", schema: { type: "object" }, maxTokens: 100, effort: "medium", timeoutMs: 5_000 });
    expect(out.items[0].key).toBe("idli");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.output_config).toEqual({ effort: "medium", format: { type: "json_schema", schema: { type: "object" } } });
    expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
  });

  it("retries when Anthropic is overloaded", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 529, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(Response.json({ content: [{ type: "text", text: "{}" }], stop_reason: "end_turn" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(claudeJson({ system: "s", prompt: "p", schema: {}, maxTokens: 10, effort: "low", timeoutMs: 5_000 })).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails clearly when the answer was cut off", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ content: [{ type: "text", text: '{"ite' }], stop_reason: "max_tokens" })));
    await expect(claudeJson({ system: "s", prompt: "p", schema: {}, maxTokens: 10, effort: "low", timeoutMs: 5_000 })).rejects.toThrow("cut off");
  });
});

describe("claudeStream", () => {
  it("streams only answer text, however the bytes are split", async () => {
    const events = [
      { type: "message_start", message: {} },
      { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "secret" } },
      { type: "content_block_start", index: 1, content_block: { type: "text" } },
      { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Eat **165 g** " } },
      { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "protein — ¾ katori dal." } },
      { type: "message_stop" },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse(events), { status: 200 })));
    const stream = await claudeStream({ system: "s", messages: [{ role: "user", content: "q" }], maxTokens: 100, effort: "low", signal: new AbortController().signal, timeoutMs: 5_000 });
    expect(await readAll(stream)).toBe("Eat **165 g** protein — ¾ katori dal.");
  });

  it("explains a rejected key before streaming starts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "invalid x-api-key" } }, { status: 401 })));
    await expect(claudeStream({ system: "s", messages: [{ role: "user", content: "q" }], maxTokens: 100, effort: "low", signal: new AbortController().signal, timeoutMs: 5_000 })).rejects.toThrow(
      "couldn't answer",
    );
  });
});
