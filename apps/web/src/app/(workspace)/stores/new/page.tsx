import { commerce, requireOrganization } from "@/lib/server";
import { getAuthEnvironment } from "@africacod/shared";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@africacod/ui";
import { StoreForm } from "@/components/business-forms";
export default async function NewStore() {
  const { session } = await requireOrganization();
  const first = !(await commerce().listStores(session.user.id)).length;
  return (
    <>
      <Link href="/stores" className="back-link">
        <ArrowLeft size={16} /> All stores
      </Link>
      <PageHeading
        eyebrow="STOREFRONT"
        title={first ? "Create your first Store" : "Create Store"}
        description="Start with your brand. Add your markets next."
      />
      <StoreForm
        publicOrigin={new URL(getAuthEnvironment().BETTER_AUTH_URL).origin}
      />
    </>
  );
}
