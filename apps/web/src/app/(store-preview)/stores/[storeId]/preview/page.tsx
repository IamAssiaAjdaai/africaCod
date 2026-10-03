import { requireOrganization, storeSettings, site } from "@/lib/server";
import { StoreGrid } from "@/components/store-grid";
import { found } from "@/lib/catalog-pages";
import { marketParam } from "@/lib/store-pages";
export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { storeId } = await params;
  const query = await searchParams;
  const { session } = await requireOrganization();
  const store = await found(storeSettings().getStore(session.user.id, storeId));
  const data = await found(
    site().browseStore(
      store.slug,
      marketParam(query.market),
      undefined,
      1,
      session.user.id,
    ),
  );
  const featured = data.store.settings.featured.enabled
    ? await site().browseStore(
        store.slug,
        marketParam(query.market),
        undefined,
        1,
        session.user.id,
        true,
      )
    : undefined;
  return (
    <StoreGrid
      home
      data={data}
      featured={featured}
      previewBase={`/stores/${storeId}/preview`}
    />
  );
}
