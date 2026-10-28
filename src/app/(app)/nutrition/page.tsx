import type { Metadata } from "next";
import { NutritionView } from "@/components/nutrition/nutrition-view";

export const metadata: Metadata = { title: "Nutrition" };

export default function NutritionPage() {
  return <NutritionView />;
}
