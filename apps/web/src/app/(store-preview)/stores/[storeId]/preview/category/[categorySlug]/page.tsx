import { requireOrganization, storeSettings, site } from "@/lib/server";
import { StoreGrid } from "@/components/store-grid";
import { found } from "@/lib/catalog-pages";
import { marketParam, pageParam } from "@/lib/store-pages";
export default async function PreviewCategory({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; categorySlug: string }>;
  searchParams: Promise<{
    market?: string | string[];
    page?: string | string[];
  }>;
}) {
  const { storeId, categorySlug } = await params;
  const query = await searchParams;
  const { session } = await requireOrganization();
  const store = await found(storeSettings().getStore(session.user.id, storeId));
  const data = await found(
    site().browseStore(
      store.slug,
      marketParam(query.market),
      categorySlug,
      pageParam(query.page),
      session.user.id,
    ),
  );
  return <StoreGrid data={data} previewBase={`/stores/${storeId}/preview`} />;
}
