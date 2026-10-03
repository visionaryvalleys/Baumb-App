import type { Metadata } from "next";
import Link from "next/link";
import { Dumbbell, History } from "lucide-react";
import { SessionLogger } from "@/components/workout/session-logger";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutPage() {
  return (
    <>
      <PageHeader
        icon={Dumbbell}
        subtitle="Planned vs actual · Progressive overload"
        title={
          <>
            Today&apos;s
            <br />
            <span className="font-semibold">Session</span>
          </>
        }
        action={
          <div className="flex gap-2">
            <Link href="/workouts" className="btn-ghost">
              <History className="size-4" aria-hidden /> History
            </Link>
            <Link href="/workouts/new" className="btn-ghost">
              Freeform log
            </Link>
          </div>
        }
      />
      <SessionLogger />
    </>
  );
}
