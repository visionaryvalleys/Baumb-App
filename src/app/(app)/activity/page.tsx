import type { Metadata } from "next";
import { Footprints } from "lucide-react";
import { ActivityView } from "@/components/activity/activity-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Activity & Recovery" };

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        icon={Footprints}
        subtitle="Steps · Sources · Recovery"
        title={
          <>
            Move &
            <br />
            <span className="font-semibold">Recover</span>
          </>
        }
      />
      <ActivityView />
    </>
  );
}
