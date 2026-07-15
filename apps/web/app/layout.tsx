import React from "react";
import "@/styles/globals.css";
import { Inter } from "next/font/google";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "LINKBASE : The AI-Powered Adaptive Link Page",
  description: "Optimized, intelligent, and real-time custom bio pages that adapt to your audience.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
