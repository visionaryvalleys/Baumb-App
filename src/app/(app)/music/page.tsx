import { Suspense } from "react";
import type { Metadata } from "next";
import { MusicPlayer } from "@/components/music-player";

export const metadata: Metadata = { title: "Music" };

export default function MusicPage() {
  return (
    <Suspense fallback={<p className="text-sm text-white/50">Loading your music…</p>}>
      <MusicPlayer />
    </Suspense>
  );
}
