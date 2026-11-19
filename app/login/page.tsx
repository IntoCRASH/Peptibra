"use client";

import Image from "next/image";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const query = useSearchParams();
  const next = query.get("next") || "/office";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const submittedEmail = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: submittedEmail, password }) });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Incorrect email or password.");
      setLoading(false);
      return;
    }
    window.location.assign(result.mustChangePassword ? "/office/settings?first=1" : next);
  }

  async function recover() {
    setError("");
    setNotice("");
    setLoading(true);
    if (!email.trim()) { setError("Enter your authorized email first."); setLoading(false); return; }
    setLoading(false);
    setNotice("Ask your administrator to reset your access.");
  }

  return (
    <main className="login-page">
      <form onSubmit={submit}>
        <div className="login-brand">
          <Image src="/brand/peptibra-logo-dark.svg" width={980} height={270} alt="Peptibra" unoptimized priority />
        </div>
        <span>ACCESO SEGURO</span>
        <h1>Oficina Peptibra</h1>
        <p className="login-intro">Una sola plataforma para administrar tu operación desde Windows, navegador o móvil.</p>
        <label>Correo autorizado<input name="email" type="email" value={email} onChange={(event)=>setEmail(event.target.value)} autoComplete="username" required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
        <button disabled={loading}>{loading ? "Ingresando…" : "Iniciar sesión"}</button>
        <button className="login-secondary" type="button" disabled={loading} onClick={recover}>Olvidé mi contraseña</button>
        {notice && <p className="login-notice">{notice}</p>}
        {error && <p className="login-error">{error}</p>}
      </form>
    </main>
  );
}

export default function Login() {
  return <Suspense fallback={<main className="login-page" />}><LoginContent /></Suspense>;
}
