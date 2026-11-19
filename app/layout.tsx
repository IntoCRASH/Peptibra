import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "./LanguageProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://peptibra.com"),
  title: "Peptibra · Research catalog",
  description: "Catálogo conectado de productos de investigación y documentación por lote.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/peptibra-mark-64.png?v=impulso", shortcut: "/brand/peptibra-mark-32.png?v=impulso", apple: "/brand/peptibra-mark-180.png?v=impulso" },
  appleWebApp: { capable: true, title: "Peptibra", statusBarStyle: "default" },
  openGraph: { title: "Peptibra · Peptide Depot", description: "Research without limits.", images: ["/brand/peptibra-share-1200x630.png?v=impulso"] },
  twitter: { card: "summary_large_image", title: "Peptibra · Peptide Depot", description: "Research without limits.", images: ["/brand/peptibra-share-1200x630.png?v=impulso"] },
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
