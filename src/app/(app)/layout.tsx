import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return <AppShell user={session}>{children}</AppShell>;
}
