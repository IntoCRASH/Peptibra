import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "./LanguageProvider";

export const metadata: Metadata = {
  title: "Peptibra · Peptide Depot",
  description: "Research compounds with batch documentation and traceability.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Peptibra · Peptide Depot", description: "Research without limits.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Peptibra · Peptide Depot", description: "Research without limits.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
