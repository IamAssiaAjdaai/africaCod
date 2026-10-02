import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@africacod/ui";
import { StoreForm } from "@/components/business-forms";
export default function NewStore() {
  return (
    <>
      <Link href="/stores" className="back-link">
        <ArrowLeft size={16} /> All stores
      </Link>
      <PageHeading
        eyebrow="A NEW CHAPTER"
        title="Create your store"
        description="Start with your brand. Add your markets next."
      />
      <StoreForm />
    </>
  );
}
