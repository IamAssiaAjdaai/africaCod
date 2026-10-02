import { publicContentPage } from "@/lib/store-pages";
import { ContentBody } from "@/components/content-body";
type Props = { params: Promise<{ storeSlug: string; pageSlug: string }> };
export async function generateMetadata({ params }: Props) {
  const { storeSlug, pageSlug } = await params;
  const page = await publicContentPage(storeSlug, pageSlug);
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
  };
}
export default async function PublicContent({ params }: Props) {
  const { storeSlug, pageSlug } = await params;
  const page = await publicContentPage(storeSlug, pageSlug);
  return (
    <main className="store-browse">
      <article className="cms-public-page">
        <h1>{page.title}</h1>
        <ContentBody content={page.content} />
      </article>
    </main>
  );
}
