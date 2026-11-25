"use client";
import { useEffect, useState } from "react";

export default function VisitCounter() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/visits", { method: "POST", signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setCount(Math.max(0, Number(data.count || 0))))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  if (count === null) return null;
  return <aside className="public-visit-counter" aria-live="polite">Este sitio ha sido visitado <b>{count.toLocaleString("es-DO")}</b> veces</aside>;
}
