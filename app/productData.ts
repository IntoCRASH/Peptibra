export type CatalogProduct = {
  slug: string;
  name: string;
  dose: string;
  category: string;
  image: string;
  cap: string;
  format: string;
  status: "Backordered";
  coaStatus: "Documentación disponible" | "Documentación en revisión";
  summary: string;
  researchFocus: string[];
};

export const products: CatalogProduct[] = [
  {
    slug: "wolverine", name: "Wolverine", dose: "10 mg", category: "Recovery Blend", image: "/products/wolverine-10mg.png", cap: "Gris", format: "Polvo liofilizado", status: "Backordered", coaStatus: "Documentación en revisión",
    summary: "Blend de investigación presentado en vial para consulta técnica y evaluación documental por lote.",
    researchFocus: ["Investigación de señalización celular", "Evaluación analítica de blends", "Consulta de composición por lote"],
  },
  {
    slug: "mots-c", name: "MOTS-c", dose: "10 mg", category: "Metabolic Research", image: "/products/mots-c-10mg-final.png", cap: "Verde", format: "Polvo liofilizado", status: "Backordered", coaStatus: "Documentación disponible",
    summary: "Péptido de investigación metabólica organizado con información de presentación y respaldo documental.",
    researchFocus: ["Investigación metabólica in vitro", "Señalización mitocondrial", "Caracterización analítica"],
  },
  {
    slug: "ghk-cu", name: "GHK-CU", dose: "100 mg", category: "Copper Peptide", image: "/products/ghk-cu-100mg-navy.png", cap: "Roja", format: "Polvo liofilizado azul marino", status: "Backordered", coaStatus: "Documentación disponible",
    summary: "Péptido de cobre para investigación, presentado con su coloración característica y trazabilidad documental.",
    researchFocus: ["Investigación de péptidos de cobre", "Caracterización de muestras", "Evaluación de identidad y pureza"],
  },
  {
    slug: "tirzepatide", name: "Tirzepatide", dose: "20 mg", category: "Metabolic Research", image: "/products/tirzepatide-20mg.png", cap: "Negra", format: "Polvo liofilizado", status: "Backordered", coaStatus: "Documentación en revisión",
    summary: "Compuesto de investigación metabólica incluido para consulta de presentación, disponibilidad y documentación.",
    researchFocus: ["Investigación de receptores in vitro", "Caracterización analítica", "Consulta documental por lote"],
  },
  {
    slug: "glp3-reta", name: "GLP-3 Reta", dose: "20 mg", category: "Triple Receptor Research", image: "/products/glp3-reta-20mg.png", cap: "Marrón", format: "Polvo liofilizado", status: "Backordered", coaStatus: "Documentación en revisión",
    summary: "Compuesto para investigación de triple receptor, presentado como parte del catálogo documentado de Peptibra.",
    researchFocus: ["Investigación multirreceptor in vitro", "Evaluación de identidad", "Revisión de documentación analítica"],
  },
];

export function getProduct(slug: string) {
  return products.find(product => product.slug === slug);
}
