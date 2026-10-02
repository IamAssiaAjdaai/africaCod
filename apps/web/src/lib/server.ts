import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@africacod/auth";
import { CommerceService } from "@africacod/domain";
import { getDatabase } from "@africacod/db";
export function commerce() {
  return new CommerceService(getDatabase());
}
export async function requireSession() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session;
}
export async function requireOrganization() {
  const session = await requireSession();
  const organization = await commerce().organizationFor(session.user.id);
  if (!organization) redirect("/onboarding");
  return { session, organization };
}
