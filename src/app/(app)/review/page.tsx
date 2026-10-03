import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { ReviewView } from "@/components/review/review-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Weekly Review" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        subtitle="Planned vs actual · Adaptive check-in"
        title={
          <>
            Weekly
            <br />
            <span className="font-semibold">Review</span>
          </>
        }
      />
      <ReviewView />
    </>
  );
}
