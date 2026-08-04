import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import AdminDashboard from "./AdminDashboard";
export const dynamic = "force-dynamic";
export default async function AdminPage(){const user=await requireChatGPTUser("/admin");return <AdminDashboard userName={user.displayName} signOut={chatGPTSignOutPath("/")}/>}
