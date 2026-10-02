"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import type { contentPages, stores } from "@africacod/db/schema";
import {
  contentAction,
  brandingAction,
  logoAction,
} from "@/lib/content-actions";
import { ContentBody } from "./content-body";
import type { FormState } from "@/lib/actions";
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
export function ContentEditor({
  storeId,
  page,
  storeSlug,
}: {
  storeId: string;
  page?: typeof contentPages.$inferSelect;
  storeSlug: string;
}) {
  const [state, action, pending] = useActionState(contentAction, {});
  const [content, setContent] = useState(page?.draftContent ?? "");
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [preview, setPreview] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  function insert(before: string, after = "") {
    const element = textarea.current;
    if (!element) return;
    const start = element.selectionStart,
      end = element.selectionEnd;
    const selection = content.slice(start, end) || "text";
    const block = ["## ", "### ", "- ", "1. "].includes(before);
    const prefix =
      block && start > 0 && content[start - 1] !== "\n" ? "\n\n" : "";
    const suffix =
      block && end < content.length && content[end] !== "\n" ? "\n\n" : "";
    const value =
      content.slice(0, start) +
      prefix +
      before +
      selection +
      after +
      suffix +
      content.slice(end);
    setContent(value);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(
        start + prefix.length + before.length,
        start + prefix.length + before.length + selection.length,
      );
    });
  }
  return (
    <section className="panel catalog-form">
      <div className="section-heading">
        <div>
          <h2>Page details</h2>
          <p className="muted">
            {page?.status === "published"
              ? "Published · Draft edits stay private until you publish again."
              : "Draft · Only published pages are publicly available."}
          </p>
        </div>
        {page && (
          <Link
            className="button button-outline"
            href={`/pages/${page.id}/preview`}
          >
            Preview saved draft
          </Link>
        )}
      </div>
      <form action={action}>
        <input type="hidden" name="storeId" value={storeId} />
        {page && <input type="hidden" name="pageId" value={page.id} />}
        <div className="form-row">
          <label>
            Title
            <input
              name="title"
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!page)
                  setSlug(
                    event.target.value
                      .normalize("NFKD")
                      .replace(/\p{M}/gu, "")
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
              }}
            />
          </label>
          <label>
            Page address
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={2}
              maxLength={100}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
            <small>
              /s/{storeSlug}/pages/{slug || "your-page"}
            </small>
          </label>
        </div>
        <label htmlFor="page-content">Content</label>
        <div
          className="content-toolbar"
          role="toolbar"
          aria-label="Content formatting"
        >
          {[
            ["Paragraph", "\n\n", ""],
            ["H2", "## ", ""],
            ["H3", "### ", ""],
            ["Bold", "**", "**"],
            ["Italic", "*", "*"],
            ["Bullet list", "- ", ""],
            ["Numbered list", "1. ", ""],
            ["Link", "[", "](https://example.com)"],
          ].map(([label, before, after]) => (
            <button
              className="button button-outline"
              type="button"
              key={label}
              onClick={() => insert(before, after)}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          id="page-content"
          ref={textarea}
          name="content"
          rows={14}
          maxLength={50000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Tell customers about your store…"
        />
        <p className="muted">
          Use blank lines for paragraphs. Formatting uses Markdown; HTML is
          displayed as text.
        </p>
        <button
          className="text-link"
          type="button"
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Hide formatting preview" : "Show formatting preview"}
        </button>
        {preview && <ContentBody content={content} />}
        <div className="form-row">
          <label>
            Meta title
            <input
              name="metaTitle"
              maxLength={200}
              defaultValue={page?.metaTitle ?? ""}
              placeholder="Leave blank to use page title"
            />
          </label>
          <label>
            Meta description
            <textarea
              name="metaDescription"
              maxLength={500}
              defaultValue={page?.metaDescription ?? ""}
            />
          </label>
        </div>
        <fieldset>
          <legend>Store navigation</legend>
          <label className="page-media-choice">
            <input
              name="showInNavigation"
              type="checkbox"
              defaultChecked={page?.showInNavigation ?? false}
            />
            Show in navigation when published
          </label>
          <div className="form-row">
            <label>
              Navigation label
              <input
                name="navigationLabel"
                maxLength={60}
                defaultValue={page?.navigationLabel ?? ""}
                placeholder="Use page title"
              />
            </label>
            <label>
              Navigation order
              <input
                name="navigationOrder"
                type="number"
                min={0}
                max={1000}
                defaultValue={page?.navigationOrder ?? 0}
              />
            </label>
          </div>
        </fieldset>
        <div className="form-actions">
          <button
            className="button button-green"
            name="intent"
            value="save"
            disabled={pending}
          >
            {pending ? "Saving…" : page ? "Save page draft" : "Create page"}
          </button>
        </div>
      </form>
      {page && (
        <form action={action} className="form-actions">
          <input type="hidden" name="pageId" value={page.id} />
          <button
            className="button button-green"
            name="intent"
            value="publish"
            disabled={pending}
          >
            Publish page
          </button>
          {page.status === "published" && (
            <>
              <button
                className="button button-outline"
                name="intent"
                value="unpublish"
                disabled={pending}
              >
                Unpublish page
              </button>
              <Link
                className="text-link"
                href={`/s/${storeSlug}/pages/${page.publishedSlug}`}
              >
                Open public page ↗
              </Link>
            </>
          )}
        </form>
      )}
      <Feedback state={state} />
    </section>
  );
}
export function BrandingEditor({
  store,
}: {
  store: typeof stores.$inferSelect;
}) {
  const [state, action, pending] = useActionState(brandingAction, {});
  const [logoState, logoUpload, logoPending] = useActionState(logoAction, {});
  return (
    <section className="panel catalog-form">
      <div className="section-heading">
        <div>
          <h2>Store branding</h2>
          <p className="muted">
            Your public storefront identity and contact details.
          </p>
        </div>
        <Link className="button button-outline" href={`/s/${store.slug}`}>
          Open storefront ↗
        </Link>
      </div>
      <form action={action}>
        <input type="hidden" name="storeId" value={store.id} />
        <label>
          Brand name
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={store.name}
          />
        </label>
        <label>
          Tagline
          <input
            name="tagline"
            maxLength={200}
            defaultValue={store.tagline ?? ""}
          />
        </label>
        <div className="form-row">
          <label>
            Public contact email
            <input
              name="contactEmail"
              type="email"
              maxLength={200}
              defaultValue={store.contactEmail ?? ""}
            />
          </label>
          <label>
            Public contact phone
            <input
              name="contactPhone"
              type="tel"
              maxLength={40}
              defaultValue={store.contactPhone ?? ""}
            />
          </label>
        </div>
        <button className="button button-green" disabled={pending}>
          {pending ? "Saving…" : "Save branding"}
        </button>
      </form>
      <Feedback state={state} />
      <form action={logoUpload} className="logo-upload">
        <input type="hidden" name="storeId" value={store.id} />
        <label>
          Store logo
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </label>
        <button className="button button-outline" disabled={logoPending}>
          {logoPending ? "Uploading…" : "Upload logo"}
        </button>
      </form>
      <Feedback state={logoState} />
    </section>
  );
}
