import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-state">
      <p className="eyebrow">404</p>
      <h1>We couldn’t find that page.</h1>
      <p>The page may have moved, or it isn’t available in your workspace.</p>
      <Link className="button button-green" href="/">
        AfricaCod home
      </Link>
    </main>
  );
}
