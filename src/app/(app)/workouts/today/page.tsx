import type { Metadata } from "next";
import { SessionRecap } from "@/components/workout/session-close";

export const metadata: Metadata = { title: "Today" };

export default function TodayWorkoutPage() {
  return <SessionRecap />;
}
