import type { Metadata, Viewport } from "next";
import { Big_Shoulders_Stencil, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const stencil = Big_Shoulders_Stencil({
  variable: "--font-stencil",
  subsets: ["latin"],
});

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
  themeColor: "#121211",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mono.variable} ${stencil.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0c0c0b] font-mono text-fg">{children}</body>
    </html>
  );
}
