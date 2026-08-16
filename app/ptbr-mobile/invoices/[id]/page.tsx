import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/app/chatgpt-auth";
import InvoicePrint from "./InvoicePrint";

export default async function InvoicePage({params}:{params:Promise<{id:string}>}){
  const user=await getAuthorizedUser();if(!user)redirect(`/login?next=/ptbr-mobile`);
  const {id}=await params;return <InvoicePrint id={id}/>;
}
