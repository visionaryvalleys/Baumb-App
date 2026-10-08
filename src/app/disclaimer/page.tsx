import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal-doc";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalDoc title="Disclaimer" updated="9 October 2026">
      <p>Calorie and macro figures from Describe the meal are estimates. They are not a laboratory result and they are not a medical device. Do not use them to calculate an insulin dose.</p>
      <p>The same dish changes with oil, recipe and portion. A sentence without a quantity is a typical home portion. A photograph cannot see oil, sugar, sauce, or how deep a bowl is. For a mixed dish, a written description is the better of the two. If you know the number, edit the log after you add it.</p>
      <p>A single day is uncertain. A run of logged days is what the journal is for. Daily targets from height, weight, age and activity are a starting formula, not a measurement of your metabolism.</p>
      <p>If you have diabetes, heart, kidney or liver disease, are pregnant, are under 18, or have had disordered eating, talk to a qualified clinician before using the numbers to change how you eat. This is not medical care.</p>
    </LegalDoc>
  );
}
