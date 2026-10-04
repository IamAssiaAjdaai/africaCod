import { redirect } from "next/navigation";
import { commerce, requireSession } from "@/lib/server";
export default async function Onboarding() {
  const { user } = await requireSession();
  // Repair older accounts without a workspace; preserve every existing membership.
  await commerce().ensureInitialOrganization(user.id);
  const stores = await commerce().listStores(user.id);
  redirect(stores.length ? "/dashboard" : "/stores/new");
}
