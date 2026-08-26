import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genogram Canvas",
  description: "A private, browser-based genogram workspace with multiple local projects and watermark-free PNG export.",
  applicationName: "Genogram Canvas",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
