import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CMS Platform",
  description: "Panel admin multi-aplikasi mobile",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="id" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
