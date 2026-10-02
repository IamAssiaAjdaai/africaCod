import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { catalog, requireOrganization } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { CategoryForm } from "@/components/catalog-forms";
export default async function CategoryDetail({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { session } = await requireOrganization();
  const { categoryId } = await params;
  const service = catalog();
  const category = await found(
    service.getCategory(session.user.id, categoryId),
  );
  const [rows, store] = await Promise.all([
    service.listCategories(session.user.id, category.storeId),
    service.getStore(session.user.id, category.storeId),
  ]);
  return (
    <>
      <Link className="back-link" href={`/categories?storeId=${store.id}`}>
        ← Categories
      </Link>
      <PageHeading
        eyebrow={store.name}
        title={category.name}
        description={
          category.parentId
            ? "Subcategory · second level"
            : "Top-level category"
        }
      />
      <div className="category-editor">
        <CategoryForm
          storeId={store.id}
          category={category}
          categories={rows}
        />
      </div>
      <p className="muted">
        Deactivate a category to keep existing product references intact.
      </p>
    </>
  );
}
