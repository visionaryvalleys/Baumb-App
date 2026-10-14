import type { Metadata, Viewport } from "next";
import { Syne } from "next/font/google";
import { ThemeRoot } from "@/components/theme-root";
import "./globals.css";

/** Syne is the Ostin wordmark, and the only typeface in the app. */
const ostin = Syne({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ostin" });

export const metadata: Metadata = {
  title: {
    default: "Ostin — Train. Track. Transform.",
    template: "%s · Ostin",
  },
  description: "Ostin is your training log: workouts, personal records, body weight, and weekly goals in one place.",
  applicationName: "Ostin",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Ostin" },
};

export const viewport: Viewport = {
  themeColor: "#1E2A27",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${ostin.variable}`}>
      <body className="page-ground min-h-full font-sans text-fg">
        <ThemeRoot />
        {children}
      </body>
    </html>
  );
}
