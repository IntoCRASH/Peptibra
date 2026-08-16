import {redirect} from "next/navigation";import {getAuthorizedUser} from "@/app/chatgpt-auth";import PriceList from "./PriceList";
export default async function PriceListPage(){if(!await getAuthorizedUser())redirect("/login?next=/ptbr-mobile/price-list");return <PriceList/>}
