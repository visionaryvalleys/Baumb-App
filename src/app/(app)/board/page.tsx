import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { RewardsBoard } from "@/components/board/rewards";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Board" };

export default function BoardPage() {
  return (
    <>
      <PageHeader
        icon={Trophy}
        subtitle="Workouts · G coins"
        title={
          <>
            The
            <br />
            <span className="font-semibold">Board</span>
          </>
        }
      />
      <RewardsBoard />
    </>
  );
}