import Link from "next/link";
export default function StoreNotFound() {
  return (
    <main className="store-browse empty-state">
      <p className="eyebrow">Page unavailable</p>
      <h1>This page is not available.</h1>
      <p>It may be unpublished or its address may have changed.</p>
      <Link className="button button-outline" href="/">
        AfricaCod home
      </Link>
    </main>
  );
}
