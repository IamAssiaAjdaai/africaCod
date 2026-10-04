import { redirect } from "next/navigation";
import { commerce, requireSession } from "@/lib/server";
import { OrganizationForm } from "@/components/business-forms";
export default async function Onboarding() {
  const { user } = await requireSession();
  if (await commerce().organizationFor(user.id)) {
    const stores = await commerce().listStores(user.id);
    redirect(stores.length ? "/dashboard" : "/stores/new");
  }
  return <OrganizationForm />;
}
