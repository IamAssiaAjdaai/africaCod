"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, Globe2, Store } from "lucide-react";
import { createOrganizationAction, createStoreAction } from "@/lib/actions";
export function OrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, {});
  return (
    <>
      <div className="onboarding-icon">
        <Building2 size={25} />
      </div>
      <p className="eyebrow">STEP 01 · YOUR BUSINESS</p>
      <h1>Give your ambition a home.</h1>
      <p className="muted">
        Create an organization to bring your stores together. You’ll be its
        owner.
      </p>
      <form action={action} className="stack-form">
        <label>
          Organization name
          <input
            name="name"
            placeholder="e.g. Assia Commerce"
            required
            minLength={2}
            maxLength={100}
            disabled={pending}
          />
          <small>You can create multiple stores in your organization.</small>
        </label>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        <button className="button button-green full-width" disabled={pending}>
          {pending ? "Creating…" : "Create organization"}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="onboarding-note">
        <Check size={15} /> Your organization stays private to your account.
      </p>
    </>
  );
}
export function StoreForm() {
  const [state, action, pending] = useActionState(createStoreAction, {});
  const [slug, setSlug] = useState("");
  const [edited, setEdited] = useState(false);
  return (
    <form action={action} className="store-form-layout">
      <section className="panel">
        <div className="panel-heading">
          <Store size={19} />
          <h2>Store details</h2>
        </div>
        <div className="stack-form">
          <label>
            Store name
            <input
              name="name"
              placeholder="e.g. Glow Beauty"
              minLength={2}
              maxLength={100}
              required
              disabled={pending}
              onChange={(e) => {
                if (!edited)
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
              }}
            />
            <small>The name of your brand or business.</small>
          </label>
          <label>
            Store address
            <input
              name="slug"
              value={slug}
              onChange={(e) => {
                setEdited(true);
                setSlug(e.target.value);
              }}
              placeholder="glow-beauty"
              minLength={3}
              maxLength={63}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              disabled={pending}
            />
            <small>
              Your unique store identifier. Lowercase letters, numbers, and
              hyphens.
            </small>
          </label>
          {state.error && (
            <p role="alert" className="form-error">
              {state.error}
            </p>
          )}
          <div className="form-actions">
            <Link className="button button-outline" href="/stores">
              Cancel
            </Link>
            <button className="button button-green" disabled={pending}>
              {pending ? "Creating…" : "Create store"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
      <aside className="info-panel">
        <span className="info-icon">
          <Globe2 size={24} />
        </span>
        <h2>
          One store.
          <br />
          Your choice of markets.
        </h2>
        <p>
          Your store starts with no markets. Once it’s created, add the
          countries where you want to sell.
        </p>
        <hr />
        <span className="inline-flex gap-2">
          <Check size={16} /> No country selected for you
        </span>
        <span className="inline-flex gap-2">
          <Check size={16} /> Local currency for each market
        </span>
      </aside>
    </form>
  );
}
