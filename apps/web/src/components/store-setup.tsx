import Link from "next/link";
import { getAuthEnvironment } from "@africacod/shared";
import { storeSetup } from "@/lib/server";
import { StoreUrl } from "./store-url";
type Store = {
  id: string;
  name: string;
  slug: string;
  settingsPublishedAt: Date | null;
};
export async function StoreSetup({
  store,
  userId,
  settingsPage = false,
}: {
  store: Store;
  userId: string;
  settingsPage?: boolean;
}) {
  const state = await storeSetup(userId, store.id);
  const base = `/stores/${store.id}`;
  const url = new URL(
    `/s/${store.slug}`,
    getAuthEnvironment().BETTER_AUTH_URL,
  ).toString();
  const steps = [
    { label: "Store created", done: true, href: base },
    {
      label: "Add a Market",
      done: state.market,
      href: `${base}#store-markets`,
    },
    {
      label: "Add your first Product",
      done: state.product,
      href: `/products/new?storeId=${store.id}`,
    },
    {
      label: "Configure Market pricing",
      done: state.pricing,
      href: `/products?storeId=${store.id}`,
    },
    {
      label: "Customize Store",
      done: state.customized,
      href: `${base}/settings`,
    },
    { label: "Publish Store", done: state.published, href: `${base}/settings` },
  ];
  return (
    <section className="panel store-setup">
      <h2>
        {store.name} · {state.published ? "Published" : "Draft / Not Published"}
      </h2>
      <StoreUrl url={url} />
      {!state.market && (
        <p>
          Add a market to preview your Store.{" "}
          <Link href={`${base}#store-markets`}>Add Market</Link>
        </p>
      )}
      <div className="form-actions">
        {!settingsPage && state.market && (
          <Link className="button button-outline" href={`${base}/preview`}>
            Preview Store
          </Link>
        )}
        {!settingsPage && (
          <Link className="button button-outline" href={`${base}/settings`}>
            Customize Store
          </Link>
        )}
        {state.published ? (
          <a
            className="button button-green"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Store
          </a>
        ) : (
          <span>Publish when ready to open your public Store.</span>
        )}
      </div>
      {!state.published && (
        <>
          <h3>Get your Store ready</h3>
          <p>{steps.filter((s) => s.done).length} of 6 completed</p>
          <ol>
            {steps.map((step) => (
              <li key={step.label}>
                {step.done ? (
                  `Complete: ${step.label}`
                ) : (
                  <Link href={step.href}>{step.label}</Link>
                )}
              </li>
            ))}
          </ol>
          {!state.pricing && (
            <p>
              Before publishing: add an active Market and an active Product with
              an active Market offer. Logos, Hero and other optional design
              settings are not required.
            </p>
          )}
        </>
      )}
    </section>
  );
}
