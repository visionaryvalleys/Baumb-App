import { useSyncExternalStore } from "react";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
}

interface ChatState {
  turns: ChatTurn[];
  streaming: boolean;
}

const MAX_KEPT = 40;
const EMPTY: ChatState = { turns: [], streaming: false };

let owner: string | null = null;
let state: ChatState = EMPTY;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

const storageKey = (userId: string) => `baumb:coach:${userId}`;

function set(next: ChatState) {
  state = next;
  listeners.forEach((l) => l());
  if (owner && !next.streaming) {
    try {
      window.sessionStorage.setItem(storageKey(owner), JSON.stringify(next.turns.slice(-MAX_KEPT)));
    } catch {}
  }
}

/** One conversation per account and browser tab; it follows the user from page to page. */
function switchOwner(userId: string | null) {
  if (userId === owner) return;
  controller?.abort();
  owner = userId;
  let turns: ChatTurn[] = [];
  try {
    if (userId) turns = JSON.parse(window.sessionStorage.getItem(storageKey(userId)) ?? "[]") as ChatTurn[];
  } catch {}
  state = { turns, streaming: false };
}

export function useHealthChat(userId: string | null): ChatState {
  if (typeof window !== "undefined") switchOwner(userId);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => EMPTY,
  );
}

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function patchLast(patch: Partial<ChatTurn>, streaming = state.streaming) {
  const turns = state.turns.slice();
  turns[turns.length - 1] = { ...turns[turns.length - 1], ...patch };
  set({ turns, streaming });
}

export async function askCoach(question: string, context: string) {
  const text = question.trim();
  if (!text || state.streaming) return;
  const history = state.turns.filter((t) => !t.failed && t.content);
  set({ turns: [...state.turns, { id: id(), role: "user", content: text }, { id: id(), role: "assistant", content: "" }], streaming: true });

  controller = new AbortController();
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...history.map(({ role, content }) => ({ role, content })), { role: "user", content: text }], context }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return patchLast({ content: body.error ?? "BAUMB Coach couldn't answer right now. Please try again.", failed: true }, false);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let answer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      answer += value;
      patchLast({ content: answer });
    }
    patchLast(answer.trim() ? { content: answer } : { content: "No answer came back. Please try again.", failed: true }, false);
  } catch {
    const partial = state.turns.at(-1)?.content;
    patchLast(controller?.signal.aborted ? { content: partial || "Stopped.", failed: !partial } : { content: "Can't reach BAUMB right now. Check your connection and try again.", failed: true }, false);
  } finally {
    controller = null;
  }
}

export function stopCoach() {
  controller?.abort();
}

export function clearCoach() {
  controller?.abort();
  set({ turns: [], streaming: false });
}
