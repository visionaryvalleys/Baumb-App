import type { Metadata } from "next";
import { ExerciseLibrary } from "@/components/exercise-library";
import { Dumbbell } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Exercises" };

export default function ExercisesPage() {
  return (
    <>
      <PageHeader
        icon={Dumbbell}
        subtitle="Technique & Personal Bests"
        title={
          <>
            Exercise
            <br />
            <span className="font-semibold">Library</span>
          </>
        }
      />
      <ExerciseLibrary />
    </>
  );
}
