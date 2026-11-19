import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peptibra · Peptide Depot",
    short_name: "Peptibra",
    description: "Catálogo y oficina virtual de Peptibra.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#ef003f",
    icons: [
      { src: "/brand/peptibra-mark-192.png?v=impulso", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/peptibra-mark-512.png?v=impulso", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/peptibra-mark-512.png?v=impulso", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
