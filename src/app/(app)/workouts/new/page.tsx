import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { WorkoutForm } from "@/components/workout-form";

export const metadata: Metadata = { title: "Log workout" };

export default function NewWorkoutPage() {
  return (
    <>
      <PageHeader
        icon={Zap}
        subtitle="Capture it while it's fresh"
        title={
          <>
            Log
            <br />
            <span className="font-semibold text-[#EDB40B]">Workout</span>
          </>
        }
      />
      <WorkoutForm />
    </>
  );
}
