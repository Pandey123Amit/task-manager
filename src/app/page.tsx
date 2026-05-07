import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";

export default async function Home() {
  const session = await getSessionFromCookies();
  if (session) redirect("/dashboard");
  redirect("/login");
}
