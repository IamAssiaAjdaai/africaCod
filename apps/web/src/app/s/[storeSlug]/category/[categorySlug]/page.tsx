import { site } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { marketParam, pageParam, publicStore } from "@/lib/store-pages";
import { StoreGrid } from "@/components/store-grid";
import { notFound } from "next/navigation";
type Props = {
  params: Promise<{ storeSlug: string; categorySlug: string }>;
  searchParams: Promise<{
    market?: string | string[];
    page?: string | string[];
  }>;
};
export async function generateMetadata({ params }: Props) {
  const { storeSlug, categorySlug } = await params;
  const store = await publicStore(storeSlug);
  const category = store.categories.find((c) => c.slug === categorySlug);
  if (!category) notFound();
  return { title: category.name };
}
export default async function Category({ params, searchParams }: Props) {
  const { storeSlug, categorySlug } = await params;
  const query = await searchParams;
  return (
    <StoreGrid
      data={await found(
        site().browseStore(
          storeSlug,
          marketParam(query.market),
          categorySlug,
          pageParam(query.page),
        ),
      )}
    />
  );
}
