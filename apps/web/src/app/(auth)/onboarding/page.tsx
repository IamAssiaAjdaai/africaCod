import { redirect } from "next/navigation";
import { commerce, requireSession } from "@/lib/server";
import { OrganizationForm } from "@/components/business-forms";
export default async function Onboarding() {
  const { user } = await requireSession();
  if (await commerce().organizationFor(user.id)) redirect("/stores");
  return <OrganizationForm />;
}
