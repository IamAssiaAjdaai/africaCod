"use client";
import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Package,
  Save,
} from "lucide-react";
import { moneyInput, currencyDecimals } from "@africacod/shared/money";
import type { FormState } from "@/lib/actions";
import {
  saveCategoryAction,
  saveProductAction,
  saveOfferAction,
  saveVariantAction,
  uploadMediaAction,
  removeMediaAction,
  reorderMediaAction,
} from "@/lib/catalog-actions";
import type {
  categories,
  products,
  productVariants,
  productMedia,
  productMarketOffers,
} from "@africacod/db/schema";
type Category = typeof categories.$inferSelect;
type Product = typeof products.$inferSelect;
type Variant = typeof productVariants.$inferSelect;
type Media = typeof productMedia.$inferSelect;
type Offer = typeof productMarketOffers.$inferSelect;
export type MarketSummary = {
  id: string;
  countryName: string;
  currency: string;
  status: "active" | "inactive";
};
function Feedback({ state }: { state: FormState }) {
  return (
    <>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="success-note" role="status">
          {state.success}
        </p>
      )}
    </>
  );
}
function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function StoreChoice({
  stores,
  storeId,
  route,
}: {
  stores: { id: string; name: string }[];
  storeId: string;
  route: string;
}) {
  const router = useRouter();
  if (stores.length < 2)
    return <p className="muted">Store: {stores[0]?.name}</p>;
  return (
    <label className="catalog-store-choice">
      Store
      <select
        value={storeId}
        onChange={(event) =>
          router.push(`${route}?storeId=${event.target.value}`)
        }
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function CategoryForm({
  storeId,
  category,
  categories,
  parentId = "",
  subcategoryOnly = false,
}: {
  storeId: string;
  category?: Category;
  categories: Category[];
  parentId?: string;
  subcategoryOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(saveCategoryAction, {});
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [customSlug, setCustomSlug] = useState(Boolean(category));
  return (
    <form action={action} className="panel catalog-form">
      <h2>
        {category
          ? "Category details"
          : parentId
            ? "New subcategory"
            : "New category"}
      </h2>
      <input type="hidden" name="storeId" value={storeId} />
      {category && (
        <input type="hidden" name="categoryId" value={category.id} />
      )}
      <fieldset disabled={pending}>
        <label>
          Name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={category?.name}
            onChange={(event) => {
              if (!customSlug) setSlug(slugify(event.target.value));
            }}
          />
        </label>
        <label>
          Slug
          <input
            name="slug"
            required
            value={slug}
            onChange={(event) => {
              setCustomSlug(true);
              setSlug(event.target.value);
            }}
          />
        </label>
        <label>
          Parent category
          <select
            name="parentId"
            required={subcategoryOnly}
            defaultValue={category?.parentId ?? parentId}
          >
            <option value="">
              {subcategoryOnly
                ? "Select a parent category"
                : "None — top-level category"}
            </option>
            {categories
              .filter((row) => !row.parentId && row.id !== category?.id)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </select>
        </label>
        <p className="muted">
          Subcategories belong to one top-level category in this store.
        </p>
        <div className="form-row">
          <label>
            Status
            <select name="status" defaultValue={category?.status ?? "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label>
            Sort order
            <input
              name="sortOrder"
              type="number"
              min="0"
              max="100000"
              defaultValue={category?.sortOrder ?? 0}
            />
          </label>
        </div>
      </fieldset>
      <Feedback state={state} />
      <div className="form-actions">
        <Link
          href={`/categories?storeId=${storeId}`}
          className="button button-outline"
        >
          Back to categories
        </Link>
        <button className="button button-green" disabled={pending}>
          <Save size={16} />
          {pending ? "Saving…" : "Save category"}
        </button>
      </div>
    </form>
  );
}
function ProductInformation({
  storeId,
  product,
  categories,
}: {
  storeId: string;
  product?: Product;
  categories: Category[];
}) {
  const [state, action, pending] = useActionState(saveProductAction, {});
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [customSlug, setCustomSlug] = useState(Boolean(product));
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(
    product?.subcategoryId ?? "",
  );
  return (
    <form
      id="product-information"
      action={action}
      className="panel catalog-form"
    >
      <h2>Product information</h2>
      <input type="hidden" name="storeId" value={storeId} />
      {product && <input type="hidden" name="productId" value={product.id} />}
      <fieldset disabled={pending}>
        <label>
          Name
          <input
            name="name"
            required
            minLength={2}
            maxLength={200}
            defaultValue={product?.name}
            placeholder="Hair Growth Serum"
            onChange={(event) => {
              if (!customSlug) setSlug(slugify(event.target.value));
            }}
          />
        </label>
        <div className="form-row">
          <label>
            SKU
            <input
              name="sku"
              maxLength={100}
              defaultValue={product?.sku ?? ""}
              placeholder="SERUM-001"
            />
          </label>
          <label>
            Slug
            <input
              name="slug"
              required
              value={slug}
              onChange={(event) => {
                setCustomSlug(true);
                setSlug(event.target.value);
              }}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Category
            <select
              name="categoryId"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setSubcategoryId("");
              }}
            >
              <option value="">No category</option>
              {categories
                .filter((row) => !row.parentId)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Subcategory
            <select
              name="subcategoryId"
              value={subcategoryId}
              onChange={(event) => setSubcategoryId(event.target.value)}
            >
              <option value="">No subcategory</option>
              {categories
                .filter((row) => row.parentId === categoryId)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          Short description
          <textarea
            name="shortDescription"
            maxLength={160}
            rows={2}
            defaultValue={product?.shortDescription ?? ""}
            placeholder="A brief introduction, up to 160 characters."
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={50000}
            rows={9}
            defaultValue={product?.description ?? ""}
            placeholder="Tell your customers about this product."
          />
        </label>
      </fieldset>
      <Feedback state={state} />
      <div className="form-actions">
        <button className="button button-green" disabled={pending}>
          <Save size={16} />
          {pending ? "Saving…" : product ? "Save product" : "Create product"}
        </button>
      </div>
    </form>
  );
}
export function ProductEditor({
  storeId,
  product,
  categories,
  markets,
  offers = [],
  media = [],
  variants = [],
  published = false,
}: {
  storeId: string;
  product?: Product;
  categories: Category[];
  markets: MarketSummary[];
  offers?: Offer[];
  media?: Media[];
  variants?: Variant[];
  published?: boolean;
}) {
  return (
    <div className="product-editor">
      <div className="catalog-stack">
        <ProductInformation
          storeId={storeId}
          product={product}
          categories={categories}
        />
        {product ? (
          <>
            <MediaEditor productId={product.id} media={media} />
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Variants</h2>
                  <p className="muted">
                    Simple sizes or versions. Offers apply to the whole product.
                  </p>
                </div>
              </div>
              <div className="catalog-stack">
                {variants.map((variant) => (
                  <VariantForm
                    key={variant.id}
                    productId={product.id}
                    variant={variant}
                  />
                ))}
                <VariantForm productId={product.id} />
              </div>
            </section>
          </>
        ) : (
          <section className="panel catalog-placeholder">
            <ImagePlus size={24} />
            <h2>Media & variants</h2>
            <p className="muted">
              Create your product first, then add images and simple variants.
            </p>
          </section>
        )}
      </div>
      <aside className="catalog-stack">
        <section className="panel">
          <h2>Product Page status</h2>
          <p>
            <strong>{published ? "Published" : "Draft"}</strong>
          </p>
          <p className="muted">
            Only published pages with an active market offer accept COD orders.
          </p>
          {product ? (
            <a className="text-link" href="#product-storefront">
              Edit storefront and publication →
            </a>
          ) : (
            <p className="muted">
              Create the product to configure its storefront.
            </p>
          )}
        </section>
        <section className="panel catalog-form">
          <h2>Status</h2>
          <label>
            Product status
            <select
              form="product-information"
              name="status"
              defaultValue={product?.status ?? "draft"}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <p className="muted">
            Organize your catalog. Publish the product storefront below.
          </p>
        </section>
        <section className="panel pricing-panel">
          <h2>Markets & pricing</h2>
          <p className="muted">
            Set an independent offer for each store market.
          </p>
          {markets.length ? (
            <div className="catalog-stack">
              {markets.map((market) =>
                product ? (
                  <OfferForm
                    key={market.id}
                    productId={product.id}
                    market={market}
                    offer={offers.find(
                      (offer) => offer.storeMarketId === market.id,
                    )}
                  />
                ) : (
                  <div key={market.id} className="offer-card">
                    <h3>
                      {market.countryName} — {market.currency}
                    </h3>
                    <p className="muted">
                      Save the product to configure an offer.
                    </p>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="catalog-empty compact">
              <Package size={26} />
              <p>No markets configured for this store.</p>
              <Link
                className="button button-outline"
                href={`/stores/${storeId}`}
              >
                Add a market
              </Link>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
function OfferForm({
  productId,
  market,
  offer,
}: {
  productId: string;
  market: MarketSummary;
  offer?: Offer;
}) {
  const [state, action, pending] = useActionState(saveOfferAction, {});
  let decimals: number;
  try {
    decimals = currencyDecimals(market.currency);
  } catch {
    return (
      <div className="offer-card">
        <h3>
          {market.countryName} — {market.currency}
        </h3>
        <p className="muted">
          This market needs a currency with monetary metadata before pricing can
          be configured.
        </p>
      </div>
    );
  }
  return (
    <details className="offer-card" open={Boolean(offer)}>
      <summary>
        <span>
          <strong>
            {market.countryName} — {market.currency}
          </strong>
          <small>
            {offer
              ? `${market.currency} ${moneyInput(offer.priceMinor, offer.currency)} · ${offer.status === "active" ? "Active" : "Inactive"} offer`
              : "Configure offer"}
            {market.status === "inactive" ? " · Market inactive" : ""}
          </small>
        </span>
        <Plus size={15} />
      </summary>
      <form
        action={action}
        aria-label={`${market.countryName} offer`}
        className="catalog-form"
      >
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="storeMarketId" value={market.id} />
        {offer && <input type="hidden" name="offerId" value={offer.id} />}
        <fieldset disabled={pending}>
          <label>
            Price ({market.currency})
            <input
              name="price"
              inputMode="decimal"
              required
              defaultValue={
                offer ? moneyInput(offer.priceMinor, offer.currency) : ""
              }
              placeholder={decimals ? "0.00" : "0"}
            />
          </label>
          <div className="form-row">
            <label>
              Compare-at price ({market.currency})
              <input
                name="compareAtPrice"
                inputMode="decimal"
                defaultValue={
                  offer?.compareAtPriceMinor != null
                    ? moneyInput(offer.compareAtPriceMinor, offer.currency)
                    : ""
                }
              />
            </label>
            <label>
              Cost ({market.currency})
              <input
                name="cost"
                inputMode="decimal"
                defaultValue={
                  offer?.costMinor != null
                    ? moneyInput(offer.costMinor, offer.currency)
                    : ""
                }
              />
            </label>
          </div>
          <label>
            Offer status
            <select
              name="status"
              defaultValue={
                offer?.status ??
                (market.status === "active" ? "active" : "inactive")
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <p className="muted">
            {market.currency} · {decimals} decimal places
          </p>
        </fieldset>
        <Feedback state={state} />
        <button className="button button-green button-small" disabled={pending}>
          {pending ? "Saving…" : `Save ${market.countryName} offer`}
        </button>
      </form>
    </details>
  );
}
function VariantForm({
  productId,
  variant,
}: {
  productId: string;
  variant?: Variant;
}) {
  const [state, action, pending] = useActionState(saveVariantAction, {});
  return (
    <form
      action={action}
      className="variant-form catalog-form"
      aria-label={variant ? `Variant ${variant.name}` : "Add variant"}
    >
      <input type="hidden" name="productId" value={productId} />
      {variant && <input type="hidden" name="variantId" value={variant.id} />}
      <h3>{variant ? variant.name : "Add a variant"}</h3>
      <fieldset disabled={pending}>
        <div className="form-row">
          <label>
            Variant name
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={variant?.name}
              placeholder="50 ml"
            />
          </label>
          <label>
            Variant SKU
            <input
              name="sku"
              maxLength={100}
              defaultValue={variant?.sku ?? ""}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Variant status
            <select name="status" defaultValue={variant?.status ?? "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label>
            Variant order
            <input
              name="sortOrder"
              type="number"
              min="0"
              max="100000"
              defaultValue={variant?.sortOrder ?? 0}
            />
          </label>
        </div>
      </fieldset>
      <Feedback state={state} />
      <button className="button button-outline button-small" disabled={pending}>
        {pending ? "Saving…" : variant ? "Save variant" : "Add variant"}
      </button>
    </form>
  );
}
function MediaEditor({
  productId,
  media,
}: {
  productId: string;
  media: Media[];
}) {
  const [state, action, pending] = useActionState(uploadMediaAction, {});
  return (
    <section className="panel">
      <h2>Product media</h2>
      <p className="muted">
        PNG, JPEG or WebP · Up to 10 MB each. First image is the list thumbnail.
      </p>
      <div className="media-grid">
        {media.map((image, index) => (
          <MediaItem
            key={image.id}
            image={image}
            productId={productId}
            media={media}
            index={index}
          />
        ))}
      </div>
      <form action={action} className="media-upload catalog-form">
        <input type="hidden" name="productId" value={productId} />
        <fieldset disabled={pending}>
          <label className="upload-label">
            <ImagePlus size={24} />
            Choose product image
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              required
              aria-label="Product image"
            />
          </label>
          <label>
            Image description
            <input
              name="altText"
              maxLength={200}
              placeholder="Describe the image for accessibility"
            />
          </label>
        </fieldset>
        <Feedback state={state} />
        <button className="button button-outline" disabled={pending}>
          {pending ? "Uploading…" : "Upload image"}
        </button>
      </form>
    </section>
  );
}
function MediaItem({
  image,
  productId,
  media,
  index,
}: {
  image: Media;
  productId: string;
  media: Media[];
  index: number;
}) {
  const [state, action, pending] = useActionState(removeMediaAction, {});
  const [orderState, orderAction, ordering] = useActionState(
    reorderMediaAction,
    {},
  );
  function order(direction: number) {
    const ids = media.map((row) => row.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    return ids;
  }
  return (
    <div className="media-item">
      <Image
        src={`/api/media/${image.id}`}
        alt={image.altText ?? "Product image"}
        width={240}
        height={180}
        unoptimized
      />
      <div className="media-tools">
        {[-1, 1].map((direction) => (
          <form action={orderAction} key={direction}>
            <input type="hidden" name="productId" value={productId} />
            {index + direction >= 0 &&
              index + direction < media.length &&
              order(direction).map((id) => (
                <input type="hidden" name="mediaId" value={id} key={id} />
              ))}
            <button
              className="button button-outline button-small"
              aria-label={`${direction === -1 ? "Move image earlier" : "Move image later"} ${index + 1}`}
              disabled={
                pending ||
                ordering ||
                index + direction < 0 ||
                index + direction >= media.length
              }
            >
              {direction === -1 ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              )}
            </button>
          </form>
        ))}
        <form action={action}>
          <input type="hidden" name="mediaId" value={image.id} />
          <button
            className="button button-outline button-small"
            aria-label={`Remove image ${index + 1}`}
            disabled={pending || ordering}
          >
            <Trash2 size={14} />
          </button>
        </form>
      </div>
      <Feedback state={state} />
      <Feedback state={orderState} />
    </div>
  );
}
