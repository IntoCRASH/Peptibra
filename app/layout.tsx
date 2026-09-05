import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "./LanguageProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://peptibra.com"),
  title: "Peptibra · Research catalog",
  description: "Catálogo conectado de productos de investigación y documentación por lote.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "Peptibra", statusBarStyle: "default" },
  openGraph: { title: "Peptibra · Peptide Depot", description: "Research without limits.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Peptibra · Peptide Depot", description: "Research without limits.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
