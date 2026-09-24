import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenGenogram",
  description: "A private, browser-based genogram workspace with multiple local projects, json and watermark-free PNG export.",
  applicationName: "OpenGenogram",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
