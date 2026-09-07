import type { Metadata } from "next";
import SiteHeader from "../SiteHeader";
import VerificationGate from "../VerificationGate";
import VialCalculator from "./VialCalculator";

export const metadata: Metadata = {
  title: "Vial calculator · Peptibra",
  description: "Convert vial concentration, volume, and U-100 syringe units.",
};

export default function CalculatorPage() {
  return <main className="pb-site pb-public-new">
    <VerificationGate />
    <SiteHeader />
    <VialCalculator />
  </main>;
}
