import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "YouTube Summarizer",
  description: "AI-powered YouTube video summaries with structured insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${space.variable} ${jetbrains.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
