import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        icon={CalendarDays}
        subtitle="Workouts · Rest · Vacation · Injury"
        title={
          <>
            Training
            <br />
            <span className="font-semibold">Calendar</span>
          </>
        }
      />
      <CalendarView />
    </>
  );
}
