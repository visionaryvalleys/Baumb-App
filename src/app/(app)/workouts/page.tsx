import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { WorkoutList } from "@/components/workout-list";

export const metadata: Metadata = { title: "Workouts" };

export default function WorkoutsPage() {
  return (
    <>
      <PageHeader
        icon={Activity}
        subtitle="Training History"
        title={
          <>
            All
            <br />
            <span className="font-semibold">Workouts</span>
          </>
        }
        action={
          <Link href="/workouts/new" className="btn-primary">
            <Plus className="size-4" aria-hidden /> Log workout
          </Link>
        }
      />
      <WorkoutList />
    </>
  );
}
