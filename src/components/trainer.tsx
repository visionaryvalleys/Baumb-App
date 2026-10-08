"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, RotateCcw, Square } from "lucide-react";
import { buildHealthContext } from "@/lib/health-context";
import { useSession } from "@/lib/session";
import { getState, useAppState } from "@/lib/store";
import { type ChatTurn, askTrainer, clearTrainer, stopTrainer, useTrainerChat } from "@/lib/trainer-chat";
import { cn } from "./ui";

const SUGGESTIONS = [
  { topic: "Nutrition", question: "How much protein do I still need today?" },
  { topic: "Meals", question: "What should I eat for dinner to hit my targets?" },
  { topic: "Plan", question: "Is my calorie target right for my goal?" },
  { topic: "Recovery", question: "How can I recover better between workouts?" },
];

const DISCLAIMER = "General guidance, not medical advice. For symptoms or medical conditions, see a doctor.";
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

const ask = (question: string) => void askTrainer(question, buildHealthContext(getState()));

/** True only when the server has a model key. Hidden until that check returns. */
export function useTrainerEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancel = false;
    void fetch("/api/ai/chat")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: boolean } | null) => {
        if (!cancel) setEnabled(data?.enabled === true);
      })
      .catch(() => {
        if (!cancel) setEnabled(false);
      });
    return () => {
      cancel = true;
    };
  }, []);
  return enabled;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

/** Paragraphs, bullet / numbered lists and **bold** — the only formatting the trainer is asked to use. */
function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(<p key={out.length}>{para.map((l, i) => [i > 0 && <br key={`b${i}`} />, ...inline(l)])}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    out.push(
      list.ordered ? (
        <ol key={out.length} className="list-decimal space-y-1 pl-5 marker:text-white/40">
          {items}
        </ol>
      ) : (
        <ul key={out.length} className="list-disc space-y-1 pl-5 marker:text-brand/70">
          {items}
        </ul>
      ),
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^#+\s*/, "");
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (BULLET.test(line)) {
      flushPara();
      const ordered = /^\s*\d/.test(line);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(line.replace(BULLET, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <>{out}</>;
}

function Thinking() {
  return (
    <span className="inline-flex items-center gap-1 py-1.5" aria-label="Thinking">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 animate-pulse rounded-full bg-white/50" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand/15 px-4 py-2.5 text-[15px] leading-relaxed text-white ring-1 ring-inset ring-brand/25">{turn.content}</div>
      </div>
    );
  }
  return (
    <div className={cn("space-y-2.5 text-[15px] leading-relaxed text-white/80", turn.failed && "text-amber-200/90")}>{turn.content ? <RichText text={turn.content} /> : <Thinking />}</div>
  );
}

function Composer({ id, onSend, streaming = false, placeholder = "Ask about your food, training, sleep or recovery…" }: { id: string; onSend: (text: string) => void; streaming?: boolean; placeholder?: string }) {
  const [draft, setDraft] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (streaming) return stopTrainer();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <form onSubmit={submit} className="relative">
      <label htmlFor={id} className="sr-only">
        Ask BAUMB Trainer
      </label>
      <textarea
        id={id}
        rows={Math.min(5, Math.max(1, draft.split("\n").length))}
        maxLength={2000}
        className="field min-h-[3.25rem] resize-none py-3.5 pr-14 leading-relaxed"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button
        type="submit"
        disabled={!streaming && !draft.trim()}
        className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-brand text-[#05070b] transition hover:brightness-110 disabled:bg-white/10 disabled:text-white/30"
        aria-label={streaming ? "Stop answer" : "Send question"}
      >
        {streaming ? <Square className="size-3.5 fill-current" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
      </button>
    </form>
  );
}

/** The full-screen conversation at /trainer. Answers stream in and use the user's own plan and logs. */
export function TrainerChat() {
  const enabled = useTrainerEnabled();
  const session = useSession();
  const { profile } = useAppState();
  const { turns, streaming } = useTrainerChat(session.user?.id ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const lastContent = turns.at(-1)?.content;

  useEffect(() => {
    const el = listRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [turns.length, lastContent]);

  function send(text: string) {
    pinned.current = true;
    ask(text);
  }

  if (enabled !== true) return null;

  return (
    // Fills the screen below the header, so only the conversation scrolls and the question box stays in reach.
    <div className="-mb-[4.5rem] flex h-[calc(100dvh-72px-3.5rem)] min-h-[28rem] flex-col sm:h-[calc(100dvh-72px-4.5rem)]">
      <header className="flex items-end justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">Your personal health &amp; fitness trainer</p>
          <h1 className="mt-2 text-[32px] font-light leading-none tracking-[-0.035em] text-white sm:text-[42px]">
            BAUMB <span className="font-semibold">Trainer</span>
          </h1>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={clearTrainer} className="btn-ghost min-h-10 shrink-0 px-4 text-sm">
            <RotateCcw className="size-4" aria-hidden /> New chat
          </button>
        )}
      </header>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-6"
        aria-live="polite"
      >
        {turns.length > 0 ? (
          <div className="mx-auto max-w-3xl space-y-6">
            {turns.map((t) => (
              <Turn key={t.id} turn={t} />
            ))}
          </div>
        ) : (
          <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center">
            <h2 className="text-[24px] font-semibold tracking-[-0.025em] text-white sm:text-[28px]">
              Hi {profile.firstName || "there"}, what are we working on today?
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-white/55">I can see your plan, today&apos;s food and your last 7 days, so answers fit you, not an average person.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.question}
                  type="button"
                  onClick={() => send(s.question)}
                  className="glass rounded-card px-4 py-3.5 text-left transition hover:bg-white/[0.06] hover:ring-1 hover:ring-inset hover:ring-brand/30"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">{s.topic}</span>
                  <span className="mt-1 block text-[14px] leading-snug text-white/80">{s.question}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <Composer id="trainer-input" onSend={send} streaming={streaming} />
        <p className="mt-2 text-center text-[11px] text-white/35">{DISCLAIMER}</p>
      </div>
    </div>
  );
}

/** Conversation used by the floating trainer button. */
export function TrainerSheet() {
  const session = useSession();
  const { turns, streaming } = useTrainerChat(session.user?.id ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastContent = turns.at(-1)?.content;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, lastContent]);

  return (
    <div>
      <div ref={listRef} className="max-h-[38dvh] space-y-4 overflow-y-auto overscroll-contain pr-1" aria-live="polite">
        {turns.length > 0 ? turns.map((turn) => <Turn key={turn.id} turn={turn} />) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {SUGGESTIONS.map((item) => (
          <button key={item.question} type="button" onClick={() => ask(item.question)} className="rounded-2xl bg-white/[0.05] px-3 py-2.5 text-left ring-1 ring-inset ring-white/10">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">{item.topic}</span>
            <span className="mt-1 block text-[13px] leading-snug text-white/80">{item.question}</span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Composer id="trainer-sheet" onSend={(text) => ask(text)} streaming={streaming} placeholder="Ask" />
      </div>
    </div>
  );
}

/** The quick way in from the dashboard: ask here and the answer opens in BAUMB Trainer. */
export function TrainerPrompt() {
  const router = useRouter();
  const session = useSession();
  const { turns, streaming } = useTrainerChat(session.user?.id ?? null);

  function send(text: string) {
    ask(text);
    router.push("/trainer");
  }

  return (
    <section aria-labelledby="trainer-prompt" className="glass mt-4 rounded-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id="trainer-prompt" className="text-[17px] font-semibold text-white">
            Ask BAUMB Trainer
          </h2>
          <p className="mt-0.5 text-sm text-white/55">Food, training, sleep or recovery. Answers use your plan and today&apos;s logs.</p>
        </div>
        {turns.length > 0 && (
          <Link href="/trainer" className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-brand hover:underline">
            {streaming ? "Answering…" : "Continue conversation"} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <Composer id="trainer-prompt-input" onSend={send} />
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.slice(0, 3).map((s) => (
          <button
            key={s.question}
            type="button"
            onClick={() => send(s.question)}
            className="rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-left text-[13px] text-white/65 transition hover:border-brand/40 hover:bg-brand/[0.06] hover:text-white"
          >
            {s.question}
          </button>
        ))}
      </div>
    </section>
  );
}
