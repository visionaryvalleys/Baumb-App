/** Free on-device trainer used when no Gemini, OpenAI, or Anthropic key is configured. The weights stay in this browser. */
const MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";

const SYSTEM = `You are Ostin Trainer inside a training and nutrition app. Answer only about health, fitness, or nutrition. Use the user's data when it is provided, and say what is missing instead of inventing logs. If the data includes a next action, repeat it and do not change the load, the sets, or the safety decision. Do not estimate muscle gained in kilograms. Do not promise abs, a fixed amount of muscle, or a body-fat percentage by a date. You are not a doctor. For chest pain, fainting, severe pain, injury, pregnancy, or medical conditions, tell the person to see a qualified professional. Keep the answer under 120 words.`;

type ChatMessage = { role: string; content: string };
type Generator = (messages: ChatMessage[], options: { max_new_tokens: number; do_sample: boolean }) => Promise<Array<{ generated_text?: ChatMessage[] | string }>>;

let ready: Promise<Generator> | null = null;

function model(): Promise<Generator> {
  ready ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    const generator = await pipeline("text-generation", MODEL, { dtype: "q4", device: "wasm" });
    return generator as Generator;
  })();
  return ready;
}

function answerFrom(value: ChatMessage[] | string | undefined): string {
  if (Array.isArray(value)) {
    const last = [...value].reverse().find((message) => message.role === "assistant" && message.content.trim());
    return last?.content.trim() ?? "";
  }
  return typeof value === "string" ? value.trim() : "";
}

/** Downloads the small model on the first question, then answers from it. */
export async function localTrainerAnswer(question: string, context: string, signal: AbortSignal): Promise<string> {
  const generator = await model();
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const output = await generator(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `User data:\n${context.slice(0, 1800)}\n\nQuestion: ${question.slice(0, 500)}` },
    ],
    { max_new_tokens: 160, do_sample: false },
  );
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return answerFrom(output[0]?.generated_text);
}
