type Asr = (audio: Float32Array, opts?: { return_timestamps?: boolean; language?: string; task?: string }) => Promise<{ text?: string } | Array<{ text?: string }>>;

let ready: Promise<Asr> | null = null;

const HALLUCINATION = /^(thanks for watching\.?|thank you\.?|thanks\.?|you\.?|bye\.?|subtitles by.*|\.*|\[.*\])$/i;

/** Loads the on-device model ahead of the first sentence so the reply is not waiting on a download. */
export function prepareTranscriber(): void {
  void model();
}

async function model(): Promise<Asr> {
  ready ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-base.en", { dtype: "q8", device: "wasm" });
    return transcriber as Asr;
  })();
  return ready;
}

async function to16k(samples: Float32Array, sampleRate: number): Promise<Float32Array> {
  if (samples.length < 2) return samples;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 0.004) return new Float32Array();
  const scale = peak < 0.95 ? 0.9 / peak : 1;
  const gained = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) gained[i] = samples[i] * scale;
  if (sampleRate === 16_000) return gained;
  const length = Math.max(1, Math.ceil((gained.length * 16_000) / sampleRate));
  const offline = new OfflineAudioContext(1, length, 16_000);
  const buffer = offline.createBuffer(1, gained.length, sampleRate);
  buffer.copyToChannel(gained, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function clean(text: string): string {
  const spoken = text
    .replace(/<\|[^|]+?\|>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spoken || HALLUCINATION.test(spoken)) return "";
  return spoken;
}

/** Turns a take into text. The audio never leaves this browser. */
export async function transcribeSamples(samples: Float32Array, sampleRate: number): Promise<string> {
  if (samples.length < sampleRate * 0.35) return "";
  const audio = await to16k(samples, sampleRate);
  if (audio.length < 16_000 * 0.35) return "";
  const transcriber = await model();
  const result = await transcriber(audio);
  const text = Array.isArray(result) ? result[0]?.text : result.text;
  return clean(text ?? "");
}
