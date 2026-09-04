import {redirect} from "next/navigation";import {getAuthorizedUser} from "@/app/chatgpt-auth";import PriceList from "./PriceList";
export default async function PriceListPage(){const user=await getAuthorizedUser();if(!user)redirect("/login?next=/ptbr-mobile/price-list");if(user.role==="vendedor")redirect("/ptbr-mobile");return <PriceList/>}
