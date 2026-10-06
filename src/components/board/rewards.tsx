"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { type BoardSnapshot, loadBoard, publishBoard } from "@/lib/board-client";
import { addDays, formatDate } from "@/lib/date";
import { G_PER_WORKOUT, REWARDS, WINNER_SPAN_DAYS, gBalance, isBoardEligible, workoutDayCount } from "@/lib/g-system";
import { actions, getState, useAppState } from "@/lib/store";
import { Card, CardTitle, EmptyState } from "../ui";

export function RewardsBoard() {
  const state = useAppState();
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
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

  const awardEnd = board?.award ? formatDate(addDays(board.award.announcedAt.slice(0, 10), WINNER_SPAN_DAYS - 1)) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardTitle action={<Trophy className="size-4 text-brand" aria-hidden />}>Leaderboard</CardTitle>
        {board?.award ? (
          <div className="mb-5 rounded-[1.4rem] bg-brand/10 px-4 py-4 ring-1 ring-inset ring-brand/30">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">Awarded</p>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-white">{board.award.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-white/65">
              Highest workout count after review: {board.award.workoutCount}. They train for five days, through {awardEnd}.
            </p>
          </div>
        ) : (
          <p className="mb-5 text-sm leading-relaxed text-white/60">Under review. The board is awarded to whoever has the most workouts once two training days are complete.</p>
        )}
        {board && board.standings.length > 0 ? (
          <ol className="grid gap-2">
            {board.standings.map((row, index) => (
              <li key={`${row.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="text-[16px] font-medium text-white">
                    {index + 1}. {row.name}
                    {row.leader && <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">Leader</span>}
                  </p>
                  <p className="text-[12px] text-white/45">{row.eligible ? `${row.workoutDays} training days` : "Not on the board yet"}</p>
                </div>
                <p className="text-[15px] font-semibold tabular-nums text-white">{row.workoutCount}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={Trophy} title="No scores yet" description="Finish a workout and your name appears here." />
        )}
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardTitle>G coins</CardTitle>
          <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-white">{balance}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            {eligible ? `Each workout you log from here adds ${G_PER_WORKOUT} G.` : `${Math.max(0, 2 - days)} training day${days === 1 ? "" : "s"} left before you can earn G and join the board.`}
          </p>
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
    </div>
  );
}
