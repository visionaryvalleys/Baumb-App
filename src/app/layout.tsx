import type { Metadata, Viewport } from "next";
import { Albert_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const albertSans = Albert_Sans({
  variable: "--font-albert-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BAUMB — Train. Track. Transform.",
    template: "%s · BAUMB",
  },
  description: "BAUMB is your training log: workouts, personal records, body weight, and weekly goals in one place.",
};

export const viewport: Viewport = {
  themeColor: "#0a0e1c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${albertSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-bm-night font-sans">{children}</body>
    </html>
  );
}
