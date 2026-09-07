"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../LanguageProvider";

type DoseUnit = "mg" | "mL" | "u100";

const vialPresets = [5, 10, 15, 20, 30, 40, 50, 100];
const waterPresets = [1, 2, 3, 5, 10];
const number = (value: string) => Number(value.replace(",", "."));
const format = (value: number, digits = 3) => value.toLocaleString("en-US", { maximumFractionDigits: digits });

export default function VialCalculator() {
  const { locale } = useLanguage();
  const es = locale === "es";
  const [vialMg, setVialMg] = useState("10");
  const [waterMl, setWaterMl] = useState("2");
  const [dose, setDose] = useState("0.25");
  const [unit, setUnit] = useState<DoseUnit>("mg");
  const [everyDays, setEveryDays] = useState("1");
  const [weeks, setWeeks] = useState("4");

  const result = useMemo(() => {
    const vial = number(vialMg), water = number(waterMl), enteredDose = number(dose);
    const interval = number(everyDays), duration = number(weeks);
    if (![vial, water, enteredDose, interval, duration].every(v => Number.isFinite(v) && v > 0)) return null;
    const concentration = vial / water;
    const doseMg = unit === "mg" ? enteredDose : unit === "mL" ? enteredDose * concentration : (enteredDose / 100) * concentration;
    const volume = doseMg / concentration;
    const syringeUnits = volume * 100;
    const applications = Math.ceil(duration * 7 / interval);
    const totalMg = applications * doseMg;
    return {
      concentration, doseMg, volume, syringeUnits, applications, totalMg,
      dosesPerVial: Math.floor(vial / doseMg),
      vials: Math.ceil(totalMg / vial),
    };
  }, [vialMg, waterMl, dose, unit, everyDays, weeks]);

  const doseLabel = unit === "u100" ? (es ? "unidades U-100" : "U-100 units") : unit;
  const syringeWidth = result ? Math.min(100, result.syringeUnits) : 0;

  return <>
    <section className="calc-head">
      <div><span>{es ? "HERRAMIENTA DE CONVERSIÓN" : "CONVERSION TOOL"}</span><h1>{es ? "Calculadora de vial" : "Vial calculator"}</h1><p>{es ? "De la concentración del vial a una lectura clara en jeringa U-100." : "From vial concentration to a clear U-100 syringe reading."}</p></div>
      <div className="calc-head-reading"><small>{es ? "LECTURA ACTUAL" : "CURRENT READING"}</small><b>{result ? format(result.syringeUnits, 1) : "—"}</b><span>{es ? "unidades U-100" : "U-100 units"}</span></div>
    </section>

    <section className="calc-workspace">
      <div className="calc-inputs">
        <article className="calc-step">
          <header><b>01</b><div><h2>{es ? "¿Qué contiene el vial?" : "What is in the vial?"}</h2><p>{es ? "Selecciona la concentración indicada en la presentación." : "Choose the amount printed on the presentation."}</p></div></header>
          <div className="calc-pills">{vialPresets.map(value => <button key={value} className={number(vialMg) === value ? "active" : ""} onClick={() => setVialMg(String(value))}>{value} mg</button>)}</div>
          <label className="calc-custom"><span>{es ? "Otra cantidad" : "Custom amount"}</span><input inputMode="decimal" value={vialMg} onChange={e => setVialMg(e.target.value)} /><b>mg</b></label>
        </article>

        <article className="calc-step">
          <header><b>02</b><div><h2>{es ? "¿Cuánto diluyente agregarás?" : "How much diluent will you add?"}</h2><p>{es ? "Indica el volumen nominal final del vial reconstituido." : "Enter the nominal final volume of the reconstituted vial."}</p></div></header>
          <div className="calc-pills">{waterPresets.map(value => <button key={value} className={number(waterMl) === value ? "active" : ""} onClick={() => setWaterMl(String(value))}>{value} mL</button>)}</div>
          <label className="calc-custom"><span>{es ? "Otro volumen" : "Custom volume"}</span><input inputMode="decimal" value={waterMl} onChange={e => setWaterMl(e.target.value)} /><b>mL</b></label>
        </article>

        <article className="calc-step">
          <header><b>03</b><div><h2>{es ? "Define la cantidad por aplicación" : "Set the amount per application"}</h2><p>{es ? "Puedes escribirla en mg, mL o directamente en unidades U-100." : "Enter it in mg, mL, or directly in U-100 units."}</p></div></header>
          <div className="calc-dose-row"><label><span>{es ? "Cantidad" : "Amount"}</span><input inputMode="decimal" value={dose} onChange={e => setDose(e.target.value)} /></label><label><span>{es ? "Unidad" : "Unit"}</span><select value={unit} onChange={e => setUnit(e.target.value as DoseUnit)}><option value="mg">mg</option><option value="mL">mL</option><option value="u100">{es ? "unidades U-100" : "U-100 units"}</option></select></label></div>
          <div className="calc-schedule"><label><span>{es ? "Cada" : "Every"}</span><input inputMode="decimal" value={everyDays} onChange={e => setEveryDays(e.target.value)} /><b>{es ? "días" : "days"}</b></label><label><span>{es ? "Durante" : "For"}</span><input inputMode="decimal" value={weeks} onChange={e => setWeeks(e.target.value)} /><b>{es ? "semanas" : "weeks"}</b></label></div>
        </article>
      </div>

      <aside className="calc-results">
        <span>{es ? "RESULTADO" : "RESULT"}</span>
        {!result ? <div className="calc-invalid">{es ? "Completa todos los campos con valores mayores que cero." : "Complete every field with values greater than zero."}</div> : <>
          <div className="calc-primary"><small>{es ? "JERINGA U-100" : "U-100 SYRINGE"}</small><strong>{format(result.syringeUnits, 1)}</strong><b>{es ? "unidades" : "units"}</b></div>
          <div className="calc-syringe" aria-label={`${format(result.syringeUnits, 1)} ${doseLabel}`}><i style={{ width: `${syringeWidth}%` }} /><div>{[0, 20, 40, 60, 80, 100].map(mark => <span key={mark}>{mark}</span>)}</div></div>
          {result.syringeUnits > 100 && <p className="calc-warning">{es ? "La lectura supera la capacidad de una jeringa U-100 de 1 mL." : "This reading exceeds a standard 1 mL U-100 syringe."}</p>}
          <div className="calc-equation"><b>{format(result.doseMg)} mg</b><span>=</span><b>{format(result.volume)} mL</b><span>=</span><b>{format(result.syringeUnits, 1)} U</b></div>
          <dl>
            <div><dt>{es ? "Concentración" : "Concentration"}</dt><dd>{format(result.concentration)} mg/mL</dd></div>
            <div><dt>{es ? "Volumen por aplicación" : "Volume per application"}</dt><dd>{format(result.volume)} mL</dd></div>
            <div><dt>{es ? "Rendimiento del vial" : "Applications per vial"}</dt><dd>{result.dosesPerVial} {es ? "aplicaciones" : "applications"}</dd></div>
            <div><dt>{es ? "Aplicaciones del período" : "Applications in period"}</dt><dd>{result.applications}</dd></div>
            <div><dt>{es ? "Cantidad total" : "Total amount"}</dt><dd>{format(result.totalMg)} mg</dd></div>
            <div className="accent"><dt>{es ? "Viales necesarios" : "Vials needed"}</dt><dd>{result.vials}</dd></div>
          </dl>
        </>}
        <p className="calc-note">{es ? "Herramienta matemática de referencia. No constituye orientación médica ni instrucciones de uso humano." : "Mathematical reference tool only. It is not medical guidance or instructions for human use."}</p>
      </aside>
    </section>
    <div className="calc-back"><Link href="/products">{es ? "Explorar productos →" : "Explore products →"}</Link></div>
  </>;
}
