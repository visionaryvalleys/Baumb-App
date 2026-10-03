import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { TransformationView } from "@/components/transformation/transformation-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Transformation" };

export default function TransformationPage() {
  return (
    <>
      <PageHeader
        icon={Sparkles}
        subtitle="Current · Target · Estimated window"
        title={
          <>
            Your
            <br />
            <span className="font-semibold">Transformation</span>
          </>
        }
      />
      <TransformationView />
    </>
  );
}
