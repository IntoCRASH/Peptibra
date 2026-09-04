import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/app/chatgpt-auth";
import SettingsClient from "./settings-client";
export default async function SettingsPage(){const user=await getAuthorizedUser();if(!user)redirect("/login?next=%2Fptbr-mobile%2Fsettings");return <SettingsClient role={user.role}/>}
