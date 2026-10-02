import { site } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { marketParam, pageParam } from "@/lib/store-pages";
import { StoreGrid } from "@/components/store-grid";
export const metadata = { title: "Products" };
export default async function Products({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{
    market?: string | string[];
    page?: string | string[];
  }>;
}) {
  const { storeSlug } = await params;
  const query = await searchParams;
  const data = await found(
    site().browseStore(
      storeSlug,
      marketParam(query.market),
      undefined,
      pageParam(query.page),
    ),
  );
  return <StoreGrid data={data} />;
}
