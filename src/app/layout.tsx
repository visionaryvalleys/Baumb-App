import type { Metadata, Viewport } from "next";
import { Inter, Syne } from "next/font/google";
import localFont from "next/font/local";
import { DailySlideGate } from "@/components/daily-slide";
import { ThemeRoot } from "@/components/theme-root";
import "./globals.css";

/** Syne is the Ostin wordmark. Inter sets the interface, DSEG7 sets the stat numbers as seven-segment digits. */
const ostin = Syne({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ostin" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const stat = localFont({ src: "./fonts/DSEG7Classic-Bold.woff2", weight: "700", variable: "--font-stat", display: "swap" });

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
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${ostin.variable} ${inter.variable} ${stat.variable}`}>
      <body className="page-ground min-h-full font-sans text-fg">
        <ThemeRoot />
        <DailySlideGate />
        {children}
      </body>
    </html>
  );
}
