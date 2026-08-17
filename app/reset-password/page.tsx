"use client";

import Image from "next/image";
import Link from "next/link";
import {FormEvent,useEffect,useMemo,useState} from "react";
import {createBrowserClient} from "@supabase/ssr";

export default function ResetPassword(){
  const[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(""),[done,setDone]=useState(false);
  const supabase=useMemo(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),[]);
  useEffect(()=>{supabase.auth.getUser().then(({data})=>{setReady(Boolean(data.user));if(!data.user)setStatus("Este enlace no es válido o ya expiró. Solicita uno nuevo desde el acceso restringido.")})},[supabase]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setStatus("");const form=new FormData(event.currentTarget),password=String(form.get("password")||""),confirm=String(form.get("confirm")||"");if(password.length<10){setStatus("La contraseña debe tener al menos 10 caracteres.");return}if(password!==confirm){setStatus("Las contraseñas no coinciden.");return}setBusy(true);const{error}=await supabase.auth.updateUser({password});setBusy(false);if(error){setStatus(error.message||"No se pudo actualizar la contraseña.");return}setDone(true);setStatus("Contraseña actualizada correctamente.")}
  return <main className="login-page"><form onSubmit={submit}><div className="login-brand"><Image src="/peptibra-logo-original.png" width={1774} height={887} alt="Peptibra Peptide Depot" priority/></div><span>ACCESO RESTRINGIDO</span><h1>Nueva contraseña</h1><p className="login-intro">Crea una clave nueva para tu oficina móvil.</p>{!done&&<><label>Nueva contraseña<input name="password" type="password" minLength={10} autoComplete="new-password" disabled={!ready} required/></label><label>Confirmar contraseña<input name="confirm" type="password" minLength={10} autoComplete="new-password" disabled={!ready} required/></label><button disabled={!ready||busy}>{busy?"Actualizando…":"Guardar contraseña"}</button></>}{status&&<p className={done?"login-notice":"login-error"}>{status}</p>}{done&&<Link className="login-link" href="/login?next=%2Fptbr-mobile">Volver al acceso restringido</Link>}{!ready&&<Link className="login-link" href="/login?next=%2Fptbr-mobile">Solicitar otro enlace</Link>}</form></main>}
