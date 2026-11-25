const targets = [
  [6.7,35],[20.5,35],[11.5,46],[16.2,46],[10.7,66],[17.2,66],
  [31.2,35],[45.1,35],[35.2,47],[41.1,47],[35.7,55],[40.6,55],
  [55.2,35],[69.3,35],[60.1,46],[64.8,46],[59.4,66],[66.2,66],
  [79.8,35],[93.8,35],[84.0,47],[89.9,47],[84.5,55],[89.4,55],
];
const zoneLabels = [["BRAZOS","Cara externa y posterior"],["ABDOMEN","A ambos lados, lejos del ombligo"],["FLANCOS","Costados del abdomen"],["MUSLOS","Zona frontal y lateral"],["GLÚTEOS","Cuadrante superior externo"]];

export default function InjectionZones(){
  return <section className="injection-zones" aria-label="Zonas generales de aplicación subcutánea">
    <header className="zones-intro"><div><small>REFERENCIA ANATÓMICA GENERAL</small><h2>Rota el lugar de aplicación</h2></div><p>Alterna las zonas para favorecer el cuidado de la piel. Evita áreas irritadas, endurecidas, lesionadas o con cicatrices.</p></header>
    <div className="zones-board">
      <div className="zones-figure" role="img" aria-label="Mujer y hombre de frente y espalda con zonas generales de aplicación subcutánea">
        <img src="/protocols/subcutaneous-figures-v2.png" alt="" />
        {targets.map(([left,top],index)=><i className="zone-target" key={index} style={{left:`${left}%`,top:`${top}%`}}><span/></i>)}
        <div className="figure-captions"><span>MUJER · FRENTE</span><span>MUJER · ESPALDA</span><span>HOMBRE · FRENTE</span><span>HOMBRE · ESPALDA</span></div>
      </div>
      <div className="zone-labels">{zoneLabels.map(([title,detail],index)=><span key={title}><i>{String(index+1).padStart(2,"0")}</i><b>{title}</b><em>{detail}</em></span>)}</div>
    </div>
    <aside><i>!</i><div><b>ANTES DE APLICAR</b><span>Aléjate al menos 5 cm del ombligo, limpia la piel y deja secar el alcohol. Utiliza material estéril nuevo y sigue siempre las indicaciones del producto o de un profesional autorizado.</span></div></aside>
  </section>
}
