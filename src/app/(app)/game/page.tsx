import type { Metadata } from "next";
import { Map } from "lucide-react";
import { GameView } from "@/components/game/game-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Game" };

export default function GamePage() {
  return (
    <>
      <PageHeader
        icon={Map}
        subtitle="Levels · Mission · Consistency"
        title={
          <>
            The
            <br />
            <span className="font-semibold">Journey</span>
          </>
        }
      />
      <GameView />
    </>
  );
}
