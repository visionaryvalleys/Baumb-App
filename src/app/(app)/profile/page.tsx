import type { Metadata } from "next";
import { ProfileSettings } from "@/components/profile-settings";
import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        icon={UserRound}
        subtitle="Profile · Goal · Training setup"
        title={
          <>
            Your
            <br />
            <span className="font-semibold">Profile</span>
          </>
        }
      />
      <ProfileSettings />
    </>
  );
}
