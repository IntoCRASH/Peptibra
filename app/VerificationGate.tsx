"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "./LanguageProvider";

const STORAGE_KEY = "peptibra_researcher_verified_v2";

export default function VerificationGate() {
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [researcherType, setResearcherType] = useState("");
  const [ageAccepted, setAgeAccepted] = useState(false);
  const [researchAccepted, setResearchAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) === "accepted";
    setVerified(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || verified) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [ready, verified]);

  if (!ready || verified) return null;

  const canEnter =
    researcherType !== "" &&
    ageAccepted &&
    researchAccepted &&
    termsAccepted;

  function enterSite() {
    if (!canEnter) return;
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setVerified(true);
  }

  function leaveSite() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.replace("about:blank");
  }

  return (
    <div className="verification-backdrop">
      <section
        className="verification-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-title"
      >
        <LanguageSwitcher compact/>
        <div className="verification-logo" aria-label="Peptibra · Peptide Depot">
          <Image
            src="/peptibra-logo-dark.png"
            width={1774}
            height={887}
            alt="Peptibra · Peptide Depot"
            unoptimized
            priority
          />
        </div>

        <h1 id="verification-title">Verificación de investigador</h1>
        <p className="verification-intro">
          El acceso está restringido a investigadores y laboratorios
          cualificados para uso in vitro y de laboratorio. Confirma los
          siguientes datos antes de continuar.
        </p>

        <label className="verification-select">
          <span>¿Qué tipo de investigador eres?</span>
          <select
            value={researcherType}
            onChange={(event) => setResearcherType(event.target.value)}
          >
            <option value="">Selecciona tu perfil...</option>
            <option value="independent">Investigador independiente</option>
            <option value="laboratory">Laboratorio o institución</option>
            <option value="academic">Investigador académico</option>
            <option value="professional">Profesional cualificado</option>
          </select>
        </label>

        <div className="verification-checks">
          <label>
            <input
              type="checkbox"
              checked={ageAccepted}
              onChange={(event) => setAgeAccepted(event.target.checked)}
            />
            <span>Confirmo que tengo al menos 21 años.</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={researchAccepted}
              onChange={(event) => setResearchAccepted(event.target.checked)}
            />
            <span>
              Confirmo que soy un investigador cualificado y que adquiriré
              productos exclusivamente para investigación in vitro o de
              laboratorio; nunca para uso humano o veterinario.
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>
              He leído y acepto los{" "}
              <a href="#terminos">Términos de venta</a> y la{" "}
              <a href="#privacidad">Política de privacidad</a>.
            </span>
          </label>
        </div>

        <button
          className="verification-enter"
          type="button"
          disabled={!canEnter}
          onClick={enterSite}
        >
          Entrar al sitio
        </button>
        <button className="verification-leave" type="button" onClick={leaveSite}>
          Salir — No cumplo los requisitos
        </button>
        <small>Declaración Peptibra · Acceso para investigación</small>
      </section>
    </div>
  );
}
