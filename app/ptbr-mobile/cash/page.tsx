import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/app/chatgpt-auth";
import CashPrint from "./CashPrint";
export default async function CashPage(){const user=await getAuthorizedUser();if(!user)redirect("/login?next=/ptbr-mobile/cash");return <CashPrint/>}
