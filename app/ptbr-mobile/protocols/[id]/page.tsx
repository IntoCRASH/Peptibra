import {redirect} from "next/navigation";import {getAuthorizedUser} from "@/app/chatgpt-auth";import ProtocolPrint from "./ProtocolPrint";
export default async function ProtocolPage({params}:{params:Promise<{id:string}>}){if(!await getAuthorizedUser())redirect("/login?next=/ptbr-mobile");return <ProtocolPrint id={(await params).id}/>}
