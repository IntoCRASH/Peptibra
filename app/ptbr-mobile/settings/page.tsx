import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/app/chatgpt-auth";
import SettingsClient from "./settings-client";
export default async function SettingsPage(){if(!await getAuthorizedUser())redirect("/login?next=%2Fptbr-mobile%2Fsettings");return <SettingsClient/>}
