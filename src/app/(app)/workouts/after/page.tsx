import type { Metadata } from "next";
import { AfterSession } from "@/components/workout/session-close";

export const metadata: Metadata = { title: "After the workout" };

export default function AfterWorkoutPage() {
  return <AfterSession />;
}
