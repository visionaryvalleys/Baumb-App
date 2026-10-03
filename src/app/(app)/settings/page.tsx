import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { SettingsView } from "@/components/settings/settings-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        icon={Settings}
        subtitle="Appearance · Units · Data"
        title={
          <>
            App
            <br />
            <span className="font-semibold">Settings</span>
          </>
        }
      />
      <SettingsView />
    </>
  );
}
