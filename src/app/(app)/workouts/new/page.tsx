import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { WorkoutDesk } from "@/components/workout/workout-desk";

export const metadata: Metadata = { title: "Let's workout" };

export default function NewWorkoutPage() {
  return (
    <>
      <PageHeader
        icon={Zap}
        subtitle="One session for the day"
        title={
          <>
            Let&apos;s
            <br />
            <span className="font-semibold text-brand">workout</span>
          </>
        }
      />
      <WorkoutDesk />
    </>
  );
}
