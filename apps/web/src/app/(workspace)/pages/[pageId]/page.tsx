import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { site, requireOrganization } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { ContentEditor } from "@/components/content-editor";
export default async function PageDetail({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { session } = await requireOrganization();
  const { pageId } = await params;
  const service = site();
  const page = await found(service.getContentPage(session.user.id, pageId));
  const store = await service.getStore(session.user.id, page.storeId);
  return (
    <>
      <Link className="back-link" href={`/pages?storeId=${store.id}`}>
        ← Pages
      </Link>
      <PageHeading
        eyebrow={store.name}
        title={page.title}
        description="Save your draft before previewing or publishing."
      />
      <ContentEditor page={page} storeId={store.id} storeSlug={store.slug} />
    </>
  );
}
