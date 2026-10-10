import type { Metadata } from "next";
import { Images } from "lucide-react";
import { GalleryFeed } from "@/components/gallery-feed";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        icon={Images}
        subtitle="Following · Daily · Quarters · Reels"
        title={
          <>
            The
            <br />
            <span className="font-semibold">Gallery</span>
          </>
        }
      />
      <GalleryFeed />
    </>
  );
}
