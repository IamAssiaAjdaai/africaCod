import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { catalog, requireOrganization } from "@/lib/server";
import { found, scalar } from "@/lib/catalog-pages";
import { CategoryForm, StoreChoice } from "@/components/catalog-forms";
export default async function NewCategory({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireOrganization();
  const query = await searchParams;
  const service = catalog();
  const stores = await service.listStores(session.user.id);
  const storeId = scalar(query.storeId) || stores[0]?.id;
  const rows = storeId
    ? await found(service.listCategories(session.user.id, storeId))
    : [];
  const parentId = scalar(query.parentId);
  if (parentId) {
    const parent = await found(service.getCategory(session.user.id, parentId));
    if (parent.storeId !== storeId || parent.parentId)
      return (
        <section className="panel">
          <h1>Choose a top-level category in this store.</h1>
          <Link href="/categories">Back to categories</Link>
        </section>
      );
  }
  return (
    <>
      <Link
        className="back-link"
        href={`/categories${storeId ? `?storeId=${storeId}` : ""}`}
      >
        ← Categories
      </Link>
      <PageHeading
        eyebrow="COMMERCE"
        title={parentId || query.sub ? "Add Subcategory" : "Add Category"}
        description="Two simple levels. A well-organized catalog."
      />
      {storeId ? (
        <>
          <StoreChoice
            stores={stores}
            storeId={storeId}
            route="/categories/new"
          />
          {query.sub && !rows.some((row) => !row.parentId) ? (
            <section className="panel">
              <h2>Add a top-level category first</h2>
              <Link
                href={`/categories/new?storeId=${storeId}`}
                className="button button-green"
              >
                Add Category
              </Link>
            </section>
          ) : (
            <div className="category-editor">
              <CategoryForm
                key={`${storeId}-${parentId}`}
                storeId={storeId}
                categories={rows}
                parentId={parentId}
                subcategoryOnly={Boolean(query.sub || parentId)}
              />
            </div>
          )}
        </>
      ) : (
        <section className="panel">
          <h2>Create a store first</h2>
          <Link href="/stores/new" className="button button-green">
            Create store
          </Link>
        </section>
      )}
    </>
  );
}
