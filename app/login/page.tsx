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
  const next = query.get("next") || "/ptbr-mobile";

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
    window.location.assign(result.mustChangePassword ? "/ptbr-mobile/settings?first=1" : next);
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
          <Image src="/peptibra-logo-original.png" width={1774} height={887} alt="Peptibra Peptide Depot" priority />
        </div>
        <span>RESTRICTED ACCESS</span>
        <h1>Virtual office</h1>
        <p className="login-intro">Secure Peptibra management from any device.</p>
        <label>Authorized email<input name="email" type="email" value={email} onChange={(event)=>setEmail(event.target.value)} autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        <button className="login-secondary" type="button" disabled={loading} onClick={recover}>Forgot my password</button>
        {notice && <p className="login-notice">{notice}</p>}
        {error && <p className="login-error">{error}</p>}
      </form>
    </main>
  );
}

export default function Login() {
  return <Suspense fallback={<main className="login-page" />}><LoginContent /></Suspense>;
}
