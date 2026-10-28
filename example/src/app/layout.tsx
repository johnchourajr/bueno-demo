import type { Metadata } from "next";
import React from "react";

import { GlobalHeader } from "@/components/GlobalHeader";
import { MetaProvider } from "@/components/Meta";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://screen-demo.muybuen.dev"),
  title: "Bueno Screen-Demo",
  description:
    "Product demo videos from a JSON script: a real browser, an eased zoom toward each click and a spring-smoothed cursor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <MetaProvider>
          <GlobalHeader />
          {children}
        </MetaProvider>
      </body>
    </html>
  );
}
