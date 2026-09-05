import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peptibra · Peptide Depot",
    short_name: "Peptibra",
    description: "Catálogo y oficina virtual de Peptibra.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#fbfaf7",
    icons: [
      { src: "/icons/peptibra-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/peptibra-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/peptibra-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
