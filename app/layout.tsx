import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Let's Gather at the Feet of God | Choose your time slot",
  description:
    "Join a continuous 24-hour time of fasting and prayer for the United Kingdom.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
