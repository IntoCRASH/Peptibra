"use client";

import Image from "next/image";
import { FormEvent, Suspense, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";

const AUTHORIZED_EMAIL = "cruzmonty1983@gmail.com";

function LoginContent() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const query = useSearchParams();
  const next = query.get("next") || "/ptbr-mobile";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    if (email !== AUTHORIZED_EMAIL) {
      setError("Esta cuenta no está autorizada.");
      setLoading(false);
      return;
    }
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    window.location.assign(next);
  }

  async function recover() {
    setError("");
    setNotice("");
    setLoading(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(AUTHORIZED_EMAIL, { redirectTo });
    setLoading(false);
    if (resetError) {
      setError("No se pudo enviar el enlace. Inténtalo nuevamente en unos minutos.");
      return;
    }
    setNotice("Te enviamos un enlace seguro para crear una contraseña nueva.");
  }

  return (
    <main className="login-page">
      <form onSubmit={submit}>
        <div className="login-brand">
          <Image src="/peptibra-logo-original.png" width={1774} height={887} alt="Peptibra Peptide Depot" priority />
        </div>
        <span>ACCESO PRIVADO</span>
        <h1>Oficina móvil</h1>
        <p className="login-intro">Gestión segura de Peptibra desde cualquier dispositivo.</p>
        <label>Correo autorizado<input name="email" type="email" defaultValue={AUTHORIZED_EMAIL} autoComplete="username" required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
        <button disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
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
