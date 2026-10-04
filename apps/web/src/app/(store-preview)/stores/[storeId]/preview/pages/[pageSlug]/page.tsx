import { requireOrganization, storeSettings, site } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { ContentBody } from "@/components/content-body";
export default async function PreviewContent({
  params,
}: {
  params: Promise<{ storeId: string; pageSlug: string }>;
}) {
  const { storeId, pageSlug } = await params;
  const { session } = await requireOrganization();
  const store = await found(storeSettings().getStore(session.user.id, storeId));
  const page = await found(
    site().getPublicContentPage(store.slug, pageSlug, session.user.id),
  );
  return (
    <main className="store-browse">
      <h1>{page.title}</h1>
      <ContentBody content={page.content} />
    </main>
  );
}
