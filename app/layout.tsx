import type { Metadata } from "next";
import "./globals.css";

// Using the system font stack instead of next/font/google: it avoids a
// network fetch to Google Fonts entirely (build works fully offline), which
// fits the project's "no unnecessary external dependency" goal.

export const metadata: Metadata = {
  title: "Meter Readings",
  description: "Water and electricity meter tracking for the apartment",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
