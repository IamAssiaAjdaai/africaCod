"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import type { PageConfig } from "@africacod/validation";
import { pageAction } from "@/lib/storefront-actions";
export function PageEditor({
  productId,
  config,
  media,
  published,
  publicUrl,
}: {
  productId: string;
  config: PageConfig;
  media: { id: string; altText: string | null }[];
  published: boolean;
  publicUrl: string;
}) {
  const [state, action, pending] = useActionState(pageAction, {});
  const [ids, setIds] = useState(config.mediaIds);
  const selectedIds = ids.filter((id) =>
    media.some((image) => image.id === id),
  );
  function move(index: number, direction: number) {
    const next = [...selectedIds];
    const destination = index + direction;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    setIds(next);
  }
  return (
    <section id="product-storefront" className="panel catalog-form">
      <div className="section-heading">
        <div>
          <h2>Product storefront</h2>
          <p className="muted">
            Cash on delivery page · {published ? "Published" : "Draft"}. Save
            changes before previewing or publishing.
          </p>
        </div>
        <Link
          className="button button-outline"
          href={`/products/${productId}/preview`}
        >
          Preview draft
        </Link>
      </div>
      <form action={action}>
        <input type="hidden" name="productId" value={productId} />
        <label>
          Headline
          <input
            name="headline"
            required
            maxLength={200}
            defaultValue={config.headline}
          />
        </label>
        <label>
          Subtitle
          <textarea
            name="subtitle"
            maxLength={500}
            defaultValue={config.subtitle}
          />
        </label>
        <label>
          Benefit bullets
          <textarea
            name="benefits"
            defaultValue={config.benefits.join("\n")}
            placeholder="One benefit per line, up to eight"
          />
        </label>
        <div className="form-row">
          <label>
            Trust message
            <input
              name="trustMessage"
              maxLength={300}
              defaultValue={config.trustMessage}
            />
          </label>
          <label>
            CTA label
            <input
              name="ctaLabel"
              required
              maxLength={60}
              defaultValue={config.ctaLabel}
            />
          </label>
        </div>
        <fieldset>
          <legend>Storefront media</legend>
          {media.length === 0 && (
            <p className="muted">
              Upload product images above to include them here.
            </p>
          )}
          {media.map((image, index) => (
            <label className="page-media-choice" key={image.id}>
              <input
                type="checkbox"
                checked={ids.includes(image.id)}
                onChange={(event) =>
                  setIds(
                    event.target.checked
                      ? [...ids, image.id]
                      : ids.filter((id) => id !== image.id),
                  )
                }
              />{" "}
              {image.altText || `Image ${index + 1}`}
            </label>
          ))}
          {selectedIds.map((id, index) => (
            <div className="media-tools" key={id}>
              <input type="hidden" name="mediaId" value={id} />
              <span>
                {index + 1}.{" "}
                {media.find((image) => image.id === id)?.altText ||
                  "Product image"}
              </span>
              <button
                type="button"
                className="button button-outline"
                onClick={() => move(index, -1)}
                disabled={index === 0}
              >
                Move up
              </button>
              <button
                type="button"
                className="button button-outline"
                onClick={() => move(index, 1)}
                disabled={index === selectedIds.length - 1}
              >
                Move down
              </button>
            </div>
          ))}
        </fieldset>
        <div className="form-actions">
          <button
            className="button button-green"
            name="intent"
            value="save"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save storefront draft"}
          </button>
        </div>
      </form>
      <form action={action} className="form-actions">
        <input type="hidden" name="productId" value={productId} />
        <button
          className="button button-green"
          name="intent"
          value="publish"
          disabled={pending}
        >
          Publish storefront
        </button>
        {published && (
          <>
            <button
              className="button button-outline"
              name="intent"
              value="unpublish"
              disabled={pending}
            >
              Unpublish storefront
            </button>
            <Link className="text-link" href={publicUrl}>
              Open public page ↗
            </Link>
          </>
        )}
      </form>
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
    </section>
  );
}
