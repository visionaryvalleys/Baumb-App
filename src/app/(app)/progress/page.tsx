import type { Metadata } from "next";
import { ProgressView } from "@/components/progress-view";
import { Medal } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader
        icon={Medal}
        subtitle="Body Weight · Volume · Records"
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
