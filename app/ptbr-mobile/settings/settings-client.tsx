"use client";

import { createBrowserClient } from "@supabase/ssr";
import { FormEvent, useEffect, useState } from "react";
import "../mobile-enhancements.css";

export default function SettingsClient() {
  const [retention, setRetention] = useState("20");
  const [partner, setPartner] = useState(false);
  const [status, setStatus] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  useEffect(() => {
    fetch("/api/mobile").then((response) => response.json()).then((data) => {
      const get = (key: string, fallback: string) => String((data.settings || []).find((item: { key: string }) => item.key === key)?.value ?? fallback);
      setRetention(get("retencion_utilidad", "20"));
      setPartner(get("ganancia_por_socio", "0") === "1");
    });
  }, []);
  async function save() {
    for (const [key, value] of [["retencion_utilidad", retention], ["ganancia_por_socio", partner ? "1" : "0"]]) {
      await fetch("/api/mobile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "saveSetting", data: { key, value } }) });
    }
    setStatus("Configuración guardada");
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const current = String(form.get("current") || "");
    const next = String(form.get("next") || "");
    const confirmation = String(form.get("confirm") || "");
    setStatus(""); setPasswordBusy(true);
    if (next.length < 10) { setStatus("La contraseña nueva debe tener al menos 10 caracteres."); setPasswordBusy(false); return; }
    if (next !== confirmation) { setStatus("Las contraseñas nuevas no coinciden."); setPasswordBusy(false); return; }
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setStatus("La sesión ya no es válida. Vuelve a entrar."); setPasswordBusy(false); return; }
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (verifyError) { setStatus("La contraseña actual no es correcta."); setPasswordBusy(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setPasswordBusy(false);
    if (updateError) { setStatus(updateError.message || "No se pudo cambiar la contraseña."); return; }
    formElement.reset();
    setStatus("Contraseña actualizada. Recuerda actualizarla también en la aplicación Windows.");
  }
  async function restore(file: File) {
    if (!confirm("El respaldo se combinará con los datos actuales. ¿Continuar?")) return;
    const body = await file.text();
    const response = await fetch("/api/mobile/backup", { method: "POST", headers: { "content-type": "application/json" }, body });
    const result = await response.json();
    setStatus(response.ok ? "Respaldo restaurado correctamente" : result.error || "No se pudo restaurar");
  }
  return <main className="settings-mobile-page">
    <header><a href="/ptbr-mobile">← Volver</a><span>CONFIGURACIÓN</span><h1>Preferencias y respaldo</h1></header>
    <section><label>Porcentaje que se guarda para el negocio<input type="number" min="0" max="100" step="0.1" value={retention} onChange={(event) => setRetention(event.target.value)} /></label><label className="settings-check"><input type="checkbox" checked={partner} onChange={(event) => setPartner(event.target.checked)} /> Separar ganancias e inventario por socio</label><button onClick={save}>Guardar preferencias</button></section>
    <section><h2>Seguridad</h2><p>Cambia la contraseña utilizada para entrar a la oficina privada.</p><form className="settings-password" onSubmit={changePassword}><label>Contraseña actual<input name="current" type="password" autoComplete="current-password" required /></label><label>Nueva contraseña<input name="next" type="password" minLength={10} autoComplete="new-password" required /></label><label>Confirmar nueva contraseña<input name="confirm" type="password" minLength={10} autoComplete="new-password" required /></label><button disabled={passwordBusy}>{passwordBusy ? "Actualizando…" : "Cambiar contraseña"}</button></form></section>
    <section><h2>Respaldo de datos</h2><p>Incluye productos, inventario, clientes, facturas, pagos, caja, equipo, proveedores, protocolos y configuraciones.</p><a className="settings-action" href="/api/mobile/backup" download>Exportar respaldo completo</a><label className="settings-action file">Importar / restaurar respaldo<input type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && restore(event.target.files[0])} /></label></section>
    {status && <p className="settings-status">{status}</p>}
  </main>;
}
