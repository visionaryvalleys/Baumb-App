"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { BOARD_VISIBLE_DAYS, type BoardSnapshot, loadBoard, publishBoard } from "@/lib/board-client";
import { startOfWeek } from "@/lib/date";
import { G_PER_WORKOUT, REWARDS, gBalance, isBoardEligible, workoutDayCount } from "@/lib/g-system";
import { useToday } from "@/lib/hooks";
import { actions, getState, useAppState } from "@/lib/store";
import { Card, CardTitle } from "../ui";

export function SessionBoard() {
  const state = useAppState();
  const today = useToday();
  const week = startOfWeek(today);
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancel = false;
    void publishBoard(state)
      .then(() => loadBoard())
      .then((next) => {
        if (!cancel) setBoard(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [state]);

  useEffect(() => {
    let cancel = false;
    const id = window.setInterval(() => {
      void loadBoard()
        .then((next) => {
          if (!cancel && next) setBoard(next);
        })
        .catch(() => undefined);
    }, 8000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, []);

  const rows = (board?.standings ?? [])
    .map((row) => ({ ...row, shown: row.weekStart === week ? row.weekCount : 0 }))
    .filter((row) => row.shown >= BOARD_VISIBLE_DAYS)
    .sort((a, b) => b.shown - a.shown || a.name.localeCompare(b.name))
    .slice(0, 10);
  const visible = showAll ? rows : rows.slice(0, 5);

  return (
    <Card>
      <CardTitle action={<Trophy className="size-4 text-brand" aria-hidden />}>Leaderboard</CardTitle>
      <p className="text-sm text-white/55">Names appear on day 3, after the exercises for day 1 and day 2 are finished. Rank is by completed days, not by reps or sets. A week runs Monday through Sunday.</p>
      {!ready ? null : rows.length > 0 ? (
        <>
          <ol className="mt-4 grid gap-2">
            {visible.map((row, index) => (
              <li key={`${row.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
                <p className="min-w-0 truncate text-[16px] font-medium text-white">
                  <span className="mr-2 tabular-nums text-brand">{index + 1}</span>
                  {row.name}
                </p>
                <p className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-white">
                  {row.shown}
                  <span className="ml-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">{row.shown === 1 ? "day" : "days"}</span>
                </p>
              </li>
            ))}
          </ol>
          {rows.length > 5 && (
            <button type="button" className="btn-ghost mt-3 h-11 w-full" onClick={() => setShowAll((open) => !open)}>
              {showAll ? "Show top 5" : "Show all"}
            </button>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-white/55">Finish day 1 and day 2. Your name appears on day 3, once that day&apos;s exercises are done.</p>
      )}
    </Card>
  );
}

export function RewardsBoard() {
  const state = useAppState();
  const [, setBoard] = useState<BoardSnapshot | null>(null);
  const balance = gBalance(state.workouts, state.redemptions);
  const days = workoutDayCount(state.workouts);
  const eligible = isBoardEligible(state.workouts);

  useEffect(() => {
    let cancel = false;
    void publishBoard(state)
      .then(() => loadBoard())
      .then((next) => {
        if (!cancel && next) setBoard(next);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [state]);

  return (
    <div className="grid gap-4">
        <Card>
          <CardTitle>G coins</CardTitle>
          <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-white">{balance}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            {eligible ? `Each workout you log from here adds ${G_PER_WORKOUT} G.` : `${Math.max(0, 2 - days)} training day${days === 1 ? "" : "s"} left before you can earn G and join the board.`}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">This week’s top ten is on the workout session.</p>
          {state.redemptions.length > 0 && (
            <ul className="mt-4 grid gap-1 text-sm text-white/55">
              {state.redemptions.map((item) => (
                <li key={item.id}>Redeemed {item.name}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Redeem</CardTitle>
          <ul className="grid gap-2">
            {REWARDS.map((item) => {
              const affordable = balance >= item.cost;
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
                  <div>
                    <p className="text-[15px] font-medium text-white">{item.name}</p>
                    <p className="text-[12px] tabular-nums text-white/45">{item.cost} G</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost h-10 px-3 text-sm"
                    disabled={!affordable}
                    onClick={() => {
                      actions.redeemReward(item);
                      void publishBoard(getState()).then(loadBoard).then((next) => next && setBoard(next));
                    }}
                  >
                    Redeem
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
    </div>
  );
}
