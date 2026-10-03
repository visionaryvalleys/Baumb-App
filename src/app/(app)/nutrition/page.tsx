import type { Metadata } from "next";
import { Utensils } from "lucide-react";
import { NutritionView } from "@/components/nutrition/nutrition-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Nutrition" };

export default function NutritionPage() {
  return (
    <>
      <PageHeader
        icon={Utensils}
        subtitle="Meals · Macros · Energy balance"
        title={
          <>
            Fuel The
            <br />
            <span className="font-semibold">Engine</span>
          </>
        }
      />
      <NutritionView />
    </>
  );
}
