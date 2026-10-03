import type { Metadata } from "next";
import { Medal } from "lucide-react";
import { ProgressView } from "@/components/progress-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader
        icon={Medal}
        subtitle="Weight trend · Measurements · Strength · Consistency"
        title={
          <>
            Season
            <br />
            <span className="font-semibold">Progress</span>
          </>
        }
      />
      <ProgressView />
    </>
  );
}
