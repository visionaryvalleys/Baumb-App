export interface Heard {
  text: string;
  /** `denied` means the microphone is blocked. `unavailable` means this browser has no recognizer. */
  reason: "ok" | "empty" | "denied" | "unavailable";
}

interface SpeechResultEvent {
  results: ArrayLike<{ 0?: { transcript: string } }>;
}

interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechCtor = new () => SpeechRec;

function recognitionCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

/**
 * Listens until the person stops speaking, or until `stop` is called.
 * Resolves with the transcript. An empty string means nothing was heard.
 */
export function recognizeSpeech(): { stop: () => void; done: Promise<Heard> } | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-IN";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let spoken = "";
  let settled = false;
  let reason: Heard["reason"] = "empty";
  let resolve: (value: Heard) => void = () => {};
  const done = new Promise<Heard>((finish) => {
    resolve = finish;
  });
  const finish = () => {
    if (settled) return;
    settled = true;
    const text = spoken.trim();
    resolve({ text, reason: text ? "ok" : reason });
  };
  rec.onresult = (event) => {
    spoken = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (spoken) reason = "ok";
  };
  rec.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") reason = "denied";
    else if (event.error === "network" || event.error === "language-not-supported") reason = "unavailable";
    finish();
  };
  rec.onend = () => finish();
  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        finish();
      }
    },
    done,
  };
}
