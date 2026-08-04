import {NextResponse} from "next/server";

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function clean(value:unknown,max=3000){return String(value??"").replace(/[<>]/g,"").trim().slice(0,max)}

export async function POST(request:Request){
  try{
    const body=await request.json();
    if(clean(body.company,100))return NextResponse.json({ok:true});
    const name=clean(body.name,100),email=clean(body.email,160),topic=clean(body.topic,100),reference=clean(body.reference,100),message=clean(body.message);
    if(!name||!emailPattern.test(email)||!topic||message.length<10)return NextResponse.json({error:"Please complete all required fields."},{status:400});
    const apiKey=process.env.RESEND_API_KEY;
    if(!apiKey)return NextResponse.json({error:"Email delivery is being configured. Please email peptibra@gmail.com directly."},{status:503});
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json"},body:JSON.stringify({
      from:process.env.CONTACT_FROM_EMAIL||"Peptibra Contact <onboarding@resend.dev>",to:["peptibra@gmail.com"],reply_to:email,subject:`Peptibra contact · ${topic}`,
      html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>New Peptibra inquiry</h2><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Topic:</strong> ${topic}</p><p><strong>Product or batch:</strong> ${reference||"Not provided"}</p><hr/><p style="white-space:pre-wrap">${message}</p></div>`
    })});
    if(!response.ok){console.error("Contact email rejected",response.status);return NextResponse.json({error:"We could not send your message. Please try again or email peptibra@gmail.com."},{status:502})}
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:"Invalid request."},{status:400})}
}
