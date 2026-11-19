"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toJpeg } from "html-to-image";
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
  const protocolCard = useRef<HTMLElement>(null);

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
  const makeJpeg = async () => {
    if (!protocolCard.current) throw new Error("Protocol card unavailable");
    return toJpeg(protocolCard.current, { quality: .96, pixelRatio: 2, backgroundColor: "#111318", cacheBust: true });
  };
  const saveJpeg = async () => { const url=await makeJpeg(),a=document.createElement("a");a.href=url;a.download=`peptibra-protocolo-${vialMg}mg.jpg`;a.click(); };
  const shareWhatsApp = async () => {
    const url=await makeJpeg(),blob=await (await fetch(url)).blob(),file=new File([blob],"protocolo-peptibra.jpg",{type:"image/jpeg"});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:"Protocolo Peptibra",text:es?"Mi cálculo de protocolo Peptibra":"My Peptibra protocol calculation",files:[file]});return;}
    await saveJpeg(); window.open(`https://wa.me/?text=${encodeURIComponent((es?"Protocolo Peptibra: ":"Peptibra protocol: ")+location.href)}`,"_blank","noopener,noreferrer");
  };

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

      <div className="calc-result-column">
      <aside className="calc-results calc-protocol-card" ref={protocolCard}>
        <header className="calc-card-brand"><Image src="/brand/peptibra-logo-light.svg" width={980} height={270} alt="Peptibra" unoptimized priority/><span>{es ? "CALCULADORA DE DILUCIÓN" : "DILUTION CALCULATOR"}</span></header>
        <span>{es ? "CONFIGURACIÓN DE MEZCLA" : "MIX CONFIGURATION"}</span>
        {!result ? <div className="calc-invalid">{es ? "Completa todos los campos con valores mayores que cero." : "Complete every field with values greater than zero."}</div> : <>
          <div className="calc-mix-summary"><div><small>{es?"AGUA BACTERIOSTÁTICA":"BACTERIOSTATIC WATER"}</small><b>{format(number(waterMl),2)} <i>mL</i></b></div><div><small>{es?"CONTENIDO DEL VIAL":"VIAL CONTENT"}</small><b>{format(number(vialMg),2)} <i>mg</i></b></div></div>
          <div className="calc-visual-grid">
            <div className="calc-data-stack">
              <span className="calc-dose-kicker">{es?"DOSIS DESEADA":"DESIRED DOSE"}</span>
              <div className="calc-dose-display"><small>{es?"Cantidad por aplicación":"Amount per application"}</small><b>{dose} <i>{doseLabel}</i></b></div>
              <div className="calc-primary"><small>{es ? "JERINGA U-100" : "U-100 SYRINGE"}</small><strong>{format(result.syringeUnits, 1)}</strong><b>{es ? "unidades" : "units"}</b></div>
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
            </div>
            <div className="calc-syringe-panel"><div className="calc-real-syringe calc-syringe-2d" role="img" aria-label={es?`Jeringa U-100 cargada a ${format(result.syringeUnits,1)} unidades`:`U-100 syringe filled to ${format(result.syringeUnits,1)} units`}><i className="syringe-needle"/><i className="syringe-hub"/><div className="syringe-barrel"><i className="calc-syringe-liquid" style={{height:`${syringeWidth}%`}}/><i className="calc-syringe-gasket" style={{top:`${syringeWidth}%`}}/></div><i className="syringe-flange"/><i className="syringe-plunger"/><i className="syringe-thumb"/><div className="calc-u100-scale" aria-hidden="true">{Array.from({length:51},(_,index)=>{const units=index*2;return <i key={units} className={units%10===0?"major":units%5===0?"medium":"minor"} style={{top:`${units}%`}}>{units%10===0?<b>{units}</b>:null}</i>})}</div><i className="calc-reading-marker" style={{top:`${82+syringeWidth*3.1}px`}}/><strong style={{top:`${68+syringeWidth*3.1}px`}}>{format(result.syringeUnits,1)} U</strong></div></div>
          </div>
        </>}
        <p className="calc-note">{es ? "Herramienta matemática de referencia. No constituye orientación médica ni instrucciones de uso humano." : "Mathematical reference tool only. It is not medical guidance or instructions for human use."}</p>
      </aside>
      <div className="calc-share-actions"><button onClick={saveJpeg}>{es?"Guardar JPG":"Save JPG"}</button><button onClick={shareWhatsApp}>WhatsApp</button></div>
      </div>
    </section>
    <div className="calc-back"><Link href="/products">{es ? "Explorar productos →" : "Explore products →"}</Link></div>
  </>;
}

