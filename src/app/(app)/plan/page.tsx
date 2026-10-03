import type { Metadata } from "next";
import { Target } from "lucide-react";
import { PlanView } from "@/components/plan/plan-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My Plan" };

export default function PlanPage() {
  return (
    <>
      <PageHeader
        icon={Target}
        subtitle="Goal · Targets · Schedule"
        title={
          <>
            Your
            <br />
            <span className="font-semibold">Plan</span>
          </>
        }
      />
      <PlanView />
    </>
  );
}
