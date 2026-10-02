import { site, requireOrganization } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { ContentBody } from "@/components/content-body";
export const metadata = {
  title: "Draft page preview",
  robots: { index: false, follow: false },
};
export default async function Preview({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { session } = await requireOrganization();
  const { pageId } = await params;
  const page = await found(site().getContentPage(session.user.id, pageId));
  return (
    <article className="panel cms-public-page">
      <p className="preview-banner">
        Saved draft preview · This content is private
      </p>
      <h1>{page.title}</h1>
      <ContentBody content={page.draftContent} />
    </article>
  );
}
