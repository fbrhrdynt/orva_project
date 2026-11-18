import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./ux-polish.css";

export const metadata: Metadata = {
  title: "orva. | Enterprise Business Platform",
  description: "A connected enterprise business platform by LogiSource Digital.",
  applicationName: "orva.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
