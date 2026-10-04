"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowUp, HeartPulse, RotateCcw, Square } from "lucide-react";
import { type ChatTurn, askCoach, clearCoach, stopCoach, useHealthChat } from "@/lib/health-chat";
import { buildHealthContext } from "@/lib/health-context";
import { useSession } from "@/lib/session";
import { getState } from "@/lib/store";
import { cn } from "./ui";

const SUGGESTIONS = [
  "How much protein do I still need today?",
  "What should I eat for dinner to hit my targets?",
  "Is my calorie target right for my goal?",
  "How can I recover better between workouts?",
];

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

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

/** Paragraphs, bullet / numbered lists and **bold** — the only formatting the coach is asked to use. */
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
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand/15 px-4 py-2.5 text-[14px] leading-relaxed text-white ring-1 ring-inset ring-brand/25">{turn.content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10" aria-hidden>
        <HeartPulse className="size-3.5 text-brand" />
      </span>
      <div className={cn("min-w-0 flex-1 space-y-2 text-[14px] leading-relaxed text-white/80", turn.failed && "text-amber-200/90")}>{turn.content ? <RichText text={turn.content} /> : <Thinking />}</div>
    </div>
  );
}

/** BAUMB Coach — the last section of every page. Answers stream in and use the user's own plan and logs. */
export function HealthChat() {
  const session = useSession();
  const { turns, streaming } = useHealthChat(session.user?.id ?? null);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastContent = turns.at(-1)?.content;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, lastContent]);

  function send(text: string) {
    if (!text.trim() || streaming) return;
    setDraft("");
    void askCoach(text, buildHealthContext(getState()));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (streaming) stopCoach();
    else send(draft);
  }

  return (
    <section aria-labelledby="coach-title" className="glass mt-10 rounded-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand ring-1 ring-inset ring-brand/25" aria-hidden>
            <HeartPulse className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="coach-title" className="text-[17px] font-semibold text-white">
              BAUMB Coach
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-white/55">Ask anything about your food, training, sleep or recovery. Answers use your plan and what you&apos;ve logged.</p>
          </div>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={clearCoach} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white">
            <RotateCcw className="size-3.5" aria-hidden /> New chat
          </button>
        )}
      </div>

      {turns.length > 0 ? (
        <div ref={listRef} className="mt-5 max-h-[30rem] space-y-4 overflow-y-auto overscroll-contain pr-1" aria-live="polite">
          {turns.map((t) => (
            <Turn key={t.id} turn={t} />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-2 text-left text-[13px] text-white/70 transition hover:border-brand/40 hover:bg-brand/[0.06] hover:text-white">
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="relative mt-4">
        <label htmlFor="coach-input" className="sr-only">
          Ask BAUMB Coach
        </label>
        <textarea
          id="coach-input"
          rows={Math.min(4, Math.max(1, draft.split("\n").length))}
          maxLength={2000}
          className="field min-h-12 resize-none py-3 pr-14 leading-relaxed"
          placeholder="Ask about your health, food or training…"
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
      <p className="mt-2 text-[11px] text-white/35">AI guidance, not medical advice. For symptoms or medical conditions, see a doctor.</p>
    </section>
  );
}
