import type { Metadata } from "next";
import React from "react";

import { GlobalHeader } from "@/components/GlobalHeader";

import "./globals.css";

const OG_ALT =
  "Bueno/Screen-Demo: agent-created product demo videos from a JSON script.";

export const metadata: Metadata = {
  metadataBase: new URL("https://screen-demo.oss.bueno.enterprises"),
  title: "Bueno Screen-Demo",
  description:
    "Agent-created product demo videos from a JSON script: a real browser, an eased zoom toward each click and a spring-smoothed cursor.",
  openGraph: {
    images: [{ url: "/og.png", width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    images: [{ url: "/og.png", alt: OG_ALT }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <GlobalHeader />
        {children}
      </body>
    </html>
  );
}
