"use client";
import {FormEvent,useState} from "react";

export default function ContactForm(){
  const [status,setStatus]=useState<"idle"|"sending"|"sent"|"error">("idle");
  const [message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setStatus("sending");setMessage("");
    const form=event.currentTarget;
    const payload=Object.fromEntries(new FormData(form));
    try{
      const response=await fetch("/api/contact",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to send your message.");
      form.reset();setStatus("sent");setMessage("Thank you. Your message has been sent to Peptibra.");
    }catch(error){setStatus("error");setMessage(error instanceof Error?error.message:"Unable to send your message.")}
  }
  return <form className="pb-contact-form" onSubmit={submit}>
    <div className="pb-contact-form-head"><span>CONTACT FORM</span><h2>Send us a message.</h2><p>We typically reply within 24 hours during support hours.</p></div>
    <input className="pb-contact-trap" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true"/>
    <div className="pb-contact-fields">
      <label>Name<input name="name" required maxLength={100} placeholder="Your name" autoComplete="name"/></label>
      <label>Email<input name="email" required type="email" maxLength={160} placeholder="you@example.com" autoComplete="email"/></label>
      <label className="wide">What can we help with?<select name="topic" required defaultValue=""><option value="" disabled>Select a topic</option><option>Product information</option><option>Batch documentation or COA</option><option>Catalog availability</option><option>Research account</option><option>Other inquiry</option></select></label>
      <label className="wide">Product or batch reference <input name="reference" maxLength={100} placeholder="Optional"/></label>
      <label className="wide">Message<textarea name="message" required minLength={10} maxLength={3000} rows={7} placeholder="Tell us how we can help..."/></label>
    </div>
    <label className="pb-contact-consent"><input type="checkbox" required/><span>I understand Peptibra provides products and documentation exclusively for research use.</span></label>
    <button className="pb-btn primary" type="submit" disabled={status==="sending"}>{status==="sending"?"Sending...":"Send message →"}</button>
    {message&&<p className={`pb-contact-status ${status}`} role="status">{message}</p>}
  </form>
}
