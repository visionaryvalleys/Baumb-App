import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Build your plan" };

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        icon={Sparkles}
        subtitle="Profile · Goal · Plan"
        title={
          <>
            Build Your
            <br />
            <span className="font-semibold">Plan</span>
          </>
        }
      />
      <OnboardingFlow />
    </>
  );
}
