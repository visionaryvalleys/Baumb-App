import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--font-playfair" });

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
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${playfair.variable}`}>
      <body className="page-ground min-h-full font-sans text-fg">{children}</body>
    </html>
  );
}
