import type { Metadata } from "next";
import { Palmtree } from "lucide-react";
import { VacationView } from "@/components/vacation/vacation-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Vacation" };

export default function VacationPage() {
  return (
    <>
      <PageHeader
        icon={Palmtree}
        subtitle="Pause without losing progress"
        title={
          <>
            Vacation
            <br />
            <span className="font-semibold">Mode</span>
          </>
        }
      />
      <VacationView />
    </>
  );
}
