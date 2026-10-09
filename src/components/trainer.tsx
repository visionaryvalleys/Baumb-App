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
      <div className="flex justify-center">
        <div className="max-w-[92%] whitespace-pre-wrap rounded-[22px] bg-white/[0.07] px-4 py-2.5 text-center text-[14px] leading-snug text-white/80 ring-1 ring-inset ring-white/10">{turn.content}</div>
      </div>
    );
  }
  return (
    <div className={cn("rounded-[24px] bg-white/[0.05] px-4 py-3.5 text-[15px] leading-relaxed text-white/85 ring-1 ring-inset ring-white/10", turn.failed && "text-amber-200/90")}>
      <div className="space-y-2.5">{turn.content ? <RichText text={turn.content} /> : <Thinking />}</div>
    </div>
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
    <form onSubmit={submit} className="flex items-end gap-1.5 rounded-[28px] border border-white/10 bg-[#1b2622] py-1.5 pl-2 pr-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
      <label htmlFor={id} className="sr-only">
        Ask BAUMB Trainer
      </label>
      <textarea
        id={id}
        rows={Math.min(5, Math.max(1, draft.split("\n").length))}
        maxLength={2000}
        className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-snug text-white outline-none placeholder:text-white/35"
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
        className="mb-0.5 grid size-11 shrink-0 place-items-center rounded-full bg-white/15 text-white transition active:bg-white/25 disabled:bg-white/[0.05] disabled:text-white/25"
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

  if (enabled === null) return null;

  return (
    // Fills the screen below the header, so only the conversation scrolls and the question box stays in reach.
    <div
      className="-mx-4 -mb-[4.5rem] flex h-[calc(100dvh-72px-3.5rem)] min-h-[28rem] flex-col bg-[#0e1412] px-4 sm:h-[calc(100dvh-72px-4.5rem)]"
      style={{
        backgroundImage: "radial-gradient(120% 72% at 50% -12%, #24382e 0%, #121816 48%, #0c0f0e 100%)",
        fontFamily: "Segoe UI, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="flex min-h-11 items-center justify-between">
        <h1 className="text-[15px] font-medium tracking-[-0.01em] text-white/90">BAUMB Trainer</h1>
        {turns.length > 0 && (
          <button type="button" onClick={clearTrainer} className="grid size-11 place-items-center rounded-full bg-white/[0.06] text-white/70 ring-1 ring-inset ring-white/10" aria-label="New chat">
            <RotateCcw className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4"
        aria-live="polite"
      >
        {turns.length > 0 ? (
          <div className="space-y-3">
            {turns.map((t) => (
              <Turn key={t.id} turn={t} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-full flex-col justify-start pt-3 pb-4">
            <p className="text-center text-[13px] text-white/50">Hi {profile.firstName || "there"}</p>
            <h2 className="mx-auto mt-1.5 max-w-[16rem] text-center text-[1.55rem] font-semibold leading-[1.15] tracking-[-0.03em] text-white">What are we working on today?</h2>
            <p className="mx-auto mt-2 max-w-[18rem] text-center text-[12px] leading-relaxed text-white/45">I can see your plan, today&apos;s food and your last 7 days, so answers fit you, not an average person.</p>
            <div className="mx-auto mt-4 grid w-full grid-cols-2 gap-1 rounded-[28px] border border-white/10 bg-white/[0.04] p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.question}
                  type="button"
                  onClick={() => send(s.question)}
                  className="flex min-h-11 flex-col justify-center rounded-[20px] px-3 py-2 text-left active:bg-white/[0.06]"
                >
                  <span className="block text-[11px] text-white/40">{s.topic}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-white/85">{s.question}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#0e1412] pb-1 pr-16 pt-2">
        <Composer id="trainer-input" onSend={send} streaming={streaming} placeholder="Ask anything…" />
        <p className="mt-2 text-center text-[11px] leading-snug text-white/35">{DISCLAIMER}</p>
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
          <button key={item.question} type="button" onClick={() => ask(item.question)} className="min-h-11 rounded-[22px] bg-white/[0.05] px-3 py-2.5 text-left ring-1 ring-inset ring-white/10">
            <span className="block text-[10px] text-white/40">{item.topic}</span>
            <span className="mt-1 block text-[13px] leading-snug text-white/85">{item.question}</span>
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
            className="min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-left text-[13px] text-white/70"
          >
            {s.question}
          </button>
        ))}
      </div>
    </section>
  );
}
