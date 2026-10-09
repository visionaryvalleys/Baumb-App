export interface Heard {
  text: string;
  /** Other phrasings from the same take, including `text`. */
  alternatives: string[];
  /** `denied` means the microphone is blocked. `unavailable` means this browser has no recognizer. */
  reason: "ok" | "empty" | "denied" | "unavailable";
}

interface SpeechAlternative {
  transcript?: string;
}

interface SpeechResult {
  length: number;
  [index: number]: SpeechAlternative | undefined;
}

interface SpeechResultEvent {
  results: ArrayLike<SpeechResult>;
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
  rec.maxAlternatives = 5;
  let spoken = "";
  let alternatives: string[] = [];
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
    resolve({ text, alternatives: text ? alternatives : [], reason: text ? "ok" : reason });
  };
  rec.onresult = (event) => {
    const results = Array.from(event.results);
    spoken = results
      .map((result) => result[0]?.transcript ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const last = results.at(-1);
    const heard = new Set<string>();
    if (spoken) heard.add(spoken);
    if (last) {
      for (let i = 0; i < last.length; i++) {
        const alt = last[i]?.transcript?.replace(/\s+/g, " ").trim();
        if (alt) heard.add(alt);
      }
    }
    alternatives = [...heard];
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
