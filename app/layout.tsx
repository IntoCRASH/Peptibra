import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";

const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] });
const display = Playfair_Display({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Peptibra · Peptide Depot",
  description: "Compuestos de alta pureza para investigación, con documentación y trazabilidad.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Peptibra · Peptide Depot", description: "Investigación sin límites.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Peptibra · Peptide Depot", description: "Investigación sin límites.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="es"><body className={`${sans.variable} ${display.variable}`}>{children}</body></html>;
}
