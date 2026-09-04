"use client";

import { FormEvent, useEffect, useState } from "react";
import "../mobile-enhancements.css";

export default function SettingsClient({ role }: { role: "admin" | "socio" | "vendedor" }) {
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
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current, next }) });
    const result = await response.json();
    setPasswordBusy(false);
    if (!response.ok) { setStatus(result.error || "No se pudo cambiar la contraseña."); return; }
    formElement.reset();
    setStatus("Contraseña actualizada correctamente.");
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
    {role === "admin" && <section><label>Porcentaje que se guarda para el negocio<input type="number" min="0" max="100" step="0.1" value={retention} onChange={(event) => setRetention(event.target.value)} /></label><label className="settings-check"><input type="checkbox" checked={partner} onChange={(event) => setPartner(event.target.checked)} /> Separar ganancias e inventario por socio</label><button onClick={save}>Guardar preferencias</button></section>}
    <section><h2>Seguridad</h2><p>Cambia la contraseña utilizada para entrar a la oficina privada.</p><form className="settings-password" onSubmit={changePassword}><label>Contraseña actual<input name="current" type="password" autoComplete="current-password" required /></label><label>Nueva contraseña<input name="next" type="password" minLength={10} autoComplete="new-password" required /></label><label>Confirmar nueva contraseña<input name="confirm" type="password" minLength={10} autoComplete="new-password" required /></label><button disabled={passwordBusy}>{passwordBusy ? "Actualizando…" : "Cambiar contraseña"}</button></form></section>
    {role === "admin" && <section><h2>Respaldo de datos</h2><p>Incluye productos, inventario, clientes, facturas, pagos, caja, equipo, proveedores, protocolos y configuraciones.</p><a className="settings-action" href="/api/mobile/backup" download>Exportar respaldo completo</a><label className="settings-action file">Importar / restaurar respaldo<input type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && restore(event.target.files[0])} /></label></section>}
    {status && <p className="settings-status">{status}</p>}
  </main>;
}
