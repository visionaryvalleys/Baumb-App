import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BAUMB — Train. Track. Transform.",
    template: "%s · BAUMB",
  },
  description: "BAUMB is your training log: workouts, personal records, body weight, and weekly goals in one place.",
  applicationName: "BAUMB",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "BAUMB" },
};

export const viewport: Viewport = {
  themeColor: "#121a17",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#0c100f] font-sans text-fg">{children}</body>
    </html>
  );
}
