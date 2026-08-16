import { chatGPTSignOutPath, requireAuthorizedUser } from "@/app/chatgpt-auth";
import MobileOffice from "./MobileOffice";
export const dynamic = "force-dynamic";
export default async function MobilePage(){
  const user=await requireAuthorizedUser("/ptbr-mobile");
  return <MobileOffice userName={user.displayName} signOut={chatGPTSignOutPath("/")}/>;
}

