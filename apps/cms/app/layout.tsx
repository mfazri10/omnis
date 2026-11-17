import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import "./globals.css";
import { ApolloProvider } from "../lib/apollo-provider";
import { Toaster } from "../components/shared/toaster";

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
    <html lang="id">
      <body>
        <ApolloProvider>{children}</ApolloProvider>
        <Toaster />
      </body>
    </html>
  );
}
