import { chatGPTSignOutPath, requireAuthorizedUser } from "@/app/chatgpt-auth";
import MobileOffice from "@/app/ptbr-mobile/MobileOffice";

export const dynamic = "force-dynamic";

export default async function OfficePage() {
  const user = await requireAuthorizedUser("/office");
  return (
    <MobileOffice
      userName={user.displayName}
      signOut={chatGPTSignOutPath("/")}
    />
  );
}
