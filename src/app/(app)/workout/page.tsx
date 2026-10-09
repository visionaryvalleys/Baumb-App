import type { Metadata } from "next";
import { Dumbbell } from "lucide-react";
import { RankStrip, RewardsBoard } from "@/components/board/rewards";
import { PageHeader } from "@/components/ui";
import { SessionLogger } from "@/components/workout/session-logger";
import { WeekPlan } from "@/components/workout/week-plan";
import { WorkoutList } from "@/components/workout-list";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutPage() {
  return (
    <>
      <PageHeader icon={Dumbbell} title={<span className="font-semibold">Workout</span>} />
      <div className="space-y-8">
        <RankStrip />
        <SessionLogger />
        <WeekPlan />
        <RewardsBoard listOnly />
        <section>
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">History</h2>
          <WorkoutList />
        </section>
      </div>
    </>
  );
}
