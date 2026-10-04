import type { Metadata } from "next";
import { TrainerChat } from "@/components/trainer";

export const metadata: Metadata = { title: "Trainer" };

export default function TrainerPage() {
  return <TrainerChat />;
}
