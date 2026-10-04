"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { StoreSettings } from "@africacod/validation";
import {
  saveStoreSettings,
  uploadStoreAsset,
} from "@/lib/store-settings-actions";
import { Markets } from "./markets";
import type { ComponentProps } from "react";
type Resource = { id: string; name: string };
const fieldNames = {
  name: "Full Name",
  phone: "Phone",
  region: "Region",
  city: "City",
  address: "Address",
  whatsapp: "WhatsApp",
  notes: "Notes",
};
function Toggle({
  label,
  value,
  change,
  disabled = false,
}: {
  label: string;
  value: boolean;
  change: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="settings-toggle">
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => change(e.target.checked)}
      />
      {label}
    </label>
  );
}
function Color({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <span className="color-control">
        <input
          aria-label={`${label} picker`}
          type="color"
          value={/^#[a-fA-F0-9]{6}$/.test(value) ? value : "#147d64"}
          onChange={(e) => change(e.target.value)}
        />
        <input
          aria-label={`${label} HEX`}
          value={value}
          maxLength={7}
          placeholder="#147d64"
          onChange={(e) => change(e.target.value)}
        />
      </span>
    </label>
  );
}
function move<T>(items: T[], index: number, direction: number) {
  const next = [...items];
  const to = index + direction;
  if (to >= 0 && to < next.length)
    [next[index], next[to]] = [next[to], next[index]];
  return next;
}
function Reorder({
  index,
  length,
  change,
}: {
  index: number;
  length: number;
  change: (direction: number) => void;
}) {
  return (
    <span className="reorder-controls">
      <button
        type="button"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => change(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Move down"
        disabled={index === length - 1}
        onClick={() => change(1)}
      >
        ↓
      </button>
    </span>
  );
}
export function StoreSettingsEditor({
  storeId,
  name,
  initial,
  categories,
  products,
  pages,
  markets,
  countries,
  readyToPublish,
}: {
  storeId: string;
  name: string;
  readyToPublish: boolean;
  initial: {
    draft: StoreSettings;
    revision: number;
    publishedRevision: number;
    publishedAt: string | null;
  };
  categories: Resource[];
  products: Resource[];
  pages: Resource[];
} & Pick<ComponentProps<typeof Markets>, "markets" | "countries">) {
  const [draft, setDraft] = useState(initial.draft);
  const [tab, setTab] = useState("Appearance");
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.draft);
  const changes = dirty || saved.revision !== saved.publishedRevision;
  function update<K extends keyof StoreSettings>(
    key: K,
    value: Partial<StoreSettings[K]>,
  ) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...value } }));
  }
  async function save(publish: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await saveStoreSettings(
        storeId,
        draft,
        saved.revision,
        publish,
      );
      if (result.error) setError(result.error);
      else if (result.revision !== undefined) {
        setSaved({
          draft: structuredClone(draft),
          revision: result.revision,
          publishedRevision: result.publishedRevision!,
          publishedAt: result.publishedAt!,
        });
        setNotice(result.success!);
      }
    } catch {
      setError("Connection interrupted. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(
    slot: "logoLight" | "logoDark" | "favicon" | "heroLight" | "heroDark",
    file?: File,
  ) {
    if (!file) return;
    setBusy(true);
    setError("");
    const data = new FormData();
    data.set("storeId", storeId);
    data.set("file", file);
    try {
      const result = await uploadStoreAsset(data);
      if (result.id) update("identity", { [slot]: result.id });
      else setError(result.error!);
    } catch {
      setError("Could not upload image.");
    } finally {
      setBusy(false);
    }
  }
  const text = (
    label: string,
    value: string | null,
    change: (v: string) => void,
    maxLength = 200,
  ) => (
    <label>
      {label}
      <input
        value={value ?? ""}
        maxLength={maxLength}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
  const destination = (
    value: StoreSettings["navigation"]["cta"]["target"],
    change: (v: StoreSettings["navigation"]["cta"]["target"]) => void,
    label = "Destination",
  ) => (
    <label>
      {label}
      <select
        value={
          value.kind === "category" || value.kind === "page"
            ? `${value.kind}:${value.id}`
            : value.kind
        }
        onChange={(e) => {
          const [kind, id] = e.target.value.split(":");
          if (kind === "category" || kind === "page") change({ kind, id });
          else if (kind === "url") change({ kind, url: "/" });
          else change({ kind: kind as "home" | "products" });
        }}
      >
        <option value="home">Store Home</option>
        <option value="products">Products</option>
        <optgroup label="Categories">
          {categories.map((c) => (
            <option key={c.id} value={`category:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Published CMS Pages">
          {pages.map((p) => (
            <option key={p.id} value={`page:${p.id}`}>
              {p.name}
            </option>
          ))}
        </optgroup>
        <option value="url">Custom HTTPS URL / local path</option>
      </select>
      {value.kind === "url" && (
        <input
          aria-label={`${label} URL`}
          value={value.url}
          onChange={(e) => change({ kind: "url", url: e.target.value })}
        />
      )}
    </label>
  );
  const navigation = (kind: "header" | "footer") => (
    <section className="panel settings-card">
      <h2>{kind === "header" ? "Header Navigation" : "Footer Navigation"}</h2>
      {draft.navigation[kind].map((link, index) => (
        <div className="settings-entry" key={link.id}>
          {text(
            "Link label",
            link.label,
            (label) =>
              update("navigation", {
                [kind]: draft.navigation[kind].map((l) =>
                  l.id === link.id ? { ...l, label } : l,
                ),
              }),
            60,
          )}
          {destination(link.target, (target) =>
            update("navigation", {
              [kind]: draft.navigation[kind].map((l) =>
                l.id === link.id ? { ...l, target } : l,
              ),
            }),
          )}
          <Reorder
            index={index}
            length={draft.navigation[kind].length}
            change={(dir) =>
              update("navigation", {
                [kind]: move(draft.navigation[kind], index, dir),
              })
            }
          />
          <button
            type="button"
            className="button button-outline"
            onClick={() =>
              update("navigation", {
                [kind]: draft.navigation[kind].filter((l) => l.id !== link.id),
              })
            }
          >
            Remove link
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button button-outline"
        disabled={draft.navigation[kind].length >= 12}
        onClick={() =>
          update("navigation", {
            [kind]: [
              ...draft.navigation[kind],
              {
                id: crypto.randomUUID(),
                label: "Products",
                target: { kind: "products" },
              },
            ],
          })
        }
      >
        Add {kind} link
      </button>
    </section>
  );
  return (
    <div className="store-settings">
      <div className="settings-toolbar">
        <div>
          <h1>Store Settings</h1>
          <p>
            {name} ·{" "}
            {!saved.publishedAt
              ? "Draft / Not Published"
              : changes
                ? "Draft changes"
                : "Published"}
          </p>
          <small>
            Last published:{" "}
            {saved.publishedAt
              ? new Date(saved.publishedAt).toLocaleString()
              : "Not yet published"}
          </small>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={busy}
            onClick={() => save(false)}
          >
            Save Draft
          </button>
          <Link
            className="button button-outline"
            href={`/stores/${storeId}/preview`}
          >
            Preview Store
          </Link>
          <button
            type="button"
            className="button button-green"
            disabled={busy || dirty || !readyToPublish}
            onClick={() => save(true)}
          >
            Publish
          </button>
        </div>
      </div>
      <p className="muted">
        Save Draft before previewing or publishing. Published settings remain
        live until you publish again.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div role="tablist" aria-label="Store Settings" className="settings-tabs">
        {["Appearance", "Product Page", "Navigation", "Markets"].map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t.replaceAll(" ", "")}`}
            aria-controls="settings-panel"
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={(event) => {
              const tabs = [
                "Appearance",
                "Product Page",
                "Navigation",
                "Markets",
              ];
              const index = tabs.indexOf(t);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % 4
                  : event.key === "ArrowLeft"
                    ? (index + 3) % 4
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 3
                        : -1;
              if (next >= 0) {
                event.preventDefault();
                setTab(tabs[next]);
                document
                  .getElementById(`tab-${tabs[next].replaceAll(" ", "")}`)
                  ?.focus();
              }
            }}
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab.replaceAll(" ", "")}`}
      >
        {tab === "Markets" ? (
          <Markets storeId={storeId} markets={markets} countries={countries} />
        ) : (
          <fieldset disabled={busy} className="settings-fieldset">
            {tab === "Appearance" && (
              <>
                <section className="panel settings-card">
                  <h2>Store Identity</h2>
                  {text(
                    "Store Name",
                    draft.identity.name ?? name,
                    (value) => update("identity", { name: value }),
                    100,
                  )}
                  {text("Tagline", draft.identity.tagline, (v) =>
                    update("identity", { tagline: v || null }),
                  )}
                  <div className="settings-media-grid">
                    {(
                      [
                        ["logoLight", "Light Mode logo"],
                        ["logoDark", "Dark Mode logo"],
                        ["favicon", "Favicon"],
                        ["heroLight", "Light Mode Hero Background"],
                        ["heroDark", "Dark Mode Hero Background"],
                      ] as const
                    ).map(([slot, label]) => (
                      <div key={slot} className="settings-media">
                        <label>
                          {label}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => upload(slot, e.target.files?.[0])}
                          />
                        </label>
                        {draft.identity[slot] && (
                          <>
                            <Image
                              unoptimized
                              width={220}
                              height={130}
                              alt={label}
                              src={`/api/stores/${storeId}/assets/${draft.identity[slot]}?w=320`}
                            />
                            <button
                              className="button button-outline"
                              type="button"
                              onClick={() =>
                                update("identity", { [slot]: null })
                              }
                            >
                              Remove {label}
                            </button>
                          </>
                        )}
                        <small>
                          Static PNG, JPEG or WebP · up to 10 MB · private until
                          published
                        </small>
                      </div>
                    ))}
                  </div>
                  {text("Contact email", draft.identity.contactEmail, (v) =>
                    update("identity", { contactEmail: v || null }),
                  )}
                  {text("Contact phone", draft.identity.contactPhone, (v) =>
                    update("identity", { contactPhone: v || null }),
                  )}
                </section>
                <section className="panel settings-card">
                  <h2>Theme</h2>
                  <div className="settings-grid">
                    <label>
                      Header Style
                      <select
                        value={draft.theme.header}
                        onChange={(e) =>
                          update("theme", {
                            header: e.target
                              .value as StoreSettings["theme"]["header"],
                          })
                        }
                      >
                        <option value="modern">Modern</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </label>
                    <label>
                      Theme Mode
                      <select
                        value={draft.theme.mode}
                        onChange={(e) =>
                          update("theme", {
                            mode: e.target
                              .value as StoreSettings["theme"]["mode"],
                          })
                        }
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">Auto / System</option>
                      </select>
                    </label>
                    <Color
                      label="Brand Color"
                      value={draft.theme.color}
                      change={(color) => update("theme", { color })}
                    />
                    <label>
                      Font
                      <select
                        value={draft.theme.font}
                        onChange={(e) =>
                          update("theme", {
                            font: e.target
                              .value as StoreSettings["theme"]["font"],
                          })
                        }
                      >
                        {["geist", "inter", "poppins", "roboto"].map((f) => (
                          <option key={f} value={f}>
                            {f[0].toUpperCase() + f.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>
                <section className="panel settings-card">
                  <h2>Announcement Bar</h2>
                  <Toggle
                    label="Enable Announcement"
                    value={draft.announcement.enabled}
                    change={(enabled) => update("announcement", { enabled })}
                  />
                  {text("Announcement Text", draft.announcement.text, (text) =>
                    update("announcement", { text }),
                  )}
                  {text(
                    "Announcement Link",
                    draft.announcement.link,
                    (link) => update("announcement", { link: link || null }),
                    2048,
                  )}
                  <div className="settings-grid">
                    <Color
                      label="Announcement Background"
                      value={draft.announcement.background}
                      change={(background) =>
                        update("announcement", { background })
                      }
                    />
                    <Color
                      label="Announcement Text Color"
                      value={draft.announcement.color}
                      change={(color) => update("announcement", { color })}
                    />
                  </div>
                </section>
                <div className="settings-grid">
                  <section className="panel settings-card">
                    <h2>Hero Section</h2>
                    <Toggle
                      label="Show Hero Section"
                      value={draft.hero.enabled}
                      change={(enabled) => update("hero", { enabled })}
                    />
                    {text(
                      "Hero Title",
                      draft.hero.title,
                      (title) => update("hero", { title }),
                      160,
                    )}
                    <label>
                      Hero Subtitle
                      <textarea
                        maxLength={500}
                        value={draft.hero.subtitle}
                        onChange={(e) =>
                          update("hero", { subtitle: e.target.value })
                        }
                      />
                    </label>
                    {text(
                      "Hero CTA Label",
                      draft.hero.ctaLabel,
                      (ctaLabel) => update("hero", { ctaLabel }),
                      60,
                    )}
                    {text(
                      "Hero CTA URL",
                      draft.hero.ctaUrl,
                      (url) => update("hero", { ctaUrl: url || null }),
                      2048,
                    )}
                  </section>
                  <section className="panel settings-card">
                    <h2>Featured Products</h2>
                    <Toggle
                      label="Show Featured Products"
                      value={draft.featured.enabled}
                      change={(enabled) => update("featured", { enabled })}
                    />
                    {text(
                      "Featured Section Title",
                      draft.featured.title,
                      (title) => update("featured", { title }),
                      100,
                    )}
                    <label>
                      Selection mode
                      <select
                        value={draft.featured.mode}
                        onChange={(e) =>
                          update("featured", {
                            mode: e.target
                              .value as StoreSettings["featured"]["mode"],
                          })
                        }
                      >
                        <option value="all">All Products</option>
                        <option value="category">Category</option>
                        <option value="manual">Manual Products</option>
                      </select>
                    </label>
                    {draft.featured.mode === "category" && (
                      <label>
                        Featured Category
                        <select
                          value={draft.featured.categoryId ?? ""}
                          onChange={(e) =>
                            update("featured", {
                              categoryId: e.target.value || null,
                            })
                          }
                        >
                          <option value="">Choose category</option>
                          {categories.map((c) => (
                            <option value={c.id} key={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {draft.featured.mode === "manual" &&
                      products.map((p) => (
                        <Toggle
                          key={p.id}
                          label={p.name}
                          value={draft.featured.productIds.includes(p.id)}
                          change={(checked) =>
                            update("featured", {
                              productIds: checked
                                ? [...draft.featured.productIds, p.id]
                                : draft.featured.productIds.filter(
                                    (id) => id !== p.id,
                                  ),
                            })
                          }
                        />
                      ))}
                    <small>
                      Only published active products with an active offer in the
                      selected Market appear.
                    </small>
                  </section>
                </div>
              </>
            )}
            {tab === "Product Page" && (
              <>
                <section className="panel settings-card">
                  <h2>Order Form</h2>
                  <label>
                    Order Form Style
                    <select
                      value={draft.productPage.mode}
                      onChange={(e) =>
                        update("productPage", {
                          mode: e.target.value as "inline" | "popup",
                        })
                      }
                    >
                      <option value="inline">Inline</option>
                      <option value="popup">Popup</option>
                    </select>
                  </label>
                  <Toggle
                    label="Sticky Order CTA"
                    value={draft.productPage.sticky}
                    change={(sticky) => update("productPage", { sticky })}
                  />
                  <Toggle
                    label="Quantity Selector"
                    value={draft.productPage.quantity}
                    change={(quantity) => update("productPage", { quantity })}
                  />
                  {text(
                    "Order Button Label",
                    draft.productPage.buttonLabel,
                    (v) => update("productPage", { buttonLabel: v || null }),
                    60,
                  )}
                  <div className="settings-grid">
                    <Color
                      label="Order Button Background"
                      value={draft.productPage.buttonBackground ?? ""}
                      change={(v) =>
                        update("productPage", { buttonBackground: v || null })
                      }
                    />
                    <Color
                      label="Order Button Text Color"
                      value={draft.productPage.buttonColor ?? ""}
                      change={(v) =>
                        update("productPage", { buttonColor: v || null })
                      }
                    />
                  </div>
                  <small>
                    Leave button colors blank to use the Store theme. Leave
                    label blank to use the published Product Page label.
                  </small>
                </section>
                <section className="panel settings-card">
                  <h2>Form Fields</h2>
                  <p className="muted">
                    Name and phone stay required. Market requirements always
                    override optional address presentation.
                  </p>
                  {[...draft.productPage.fields]
                    .sort((a, b) => a.order - b.order)
                    .map((field, index, sorted) => (
                      <div className="settings-field-row" key={field.id}>
                        <strong>{fieldNames[field.id]}</strong>
                        <label>
                          Display order
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={field.order}
                            onChange={(event) =>
                              update("productPage", {
                                fields: draft.productPage.fields.map((f) =>
                                  f.id === field.id
                                    ? {
                                        ...f,
                                        order: Number(event.target.value),
                                      }
                                    : f,
                                ),
                              })
                            }
                          />
                        </label>
                        <Toggle
                          label={`Enable ${fieldNames[field.id]}`}
                          disabled={["name", "phone"].includes(field.id)}
                          value={field.enabled}
                          change={(enabled) =>
                            update("productPage", {
                              fields: draft.productPage.fields.map((f) =>
                                f.id === field.id ? { ...f, enabled } : f,
                              ),
                            })
                          }
                        />
                        <Toggle
                          label={`Require ${fieldNames[field.id]}`}
                          disabled={["name", "phone"].includes(field.id)}
                          value={field.required}
                          change={(required) =>
                            update("productPage", {
                              fields: draft.productPage.fields.map((f) =>
                                f.id === field.id ? { ...f, required } : f,
                              ),
                            })
                          }
                        />
                        <Reorder
                          index={index}
                          length={7}
                          change={(dir) =>
                            update("productPage", {
                              fields: move(sorted, index, dir).map(
                                (f, order) => ({ ...f, order }),
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  <h3>Custom Fields</h3>
                  {draft.productPage.customFields.map((field, index) => {
                    const edit = (value: Partial<typeof field>) =>
                      update("productPage", {
                        customFields: draft.productPage.customFields.map((f) =>
                          f.id === field.id ? { ...f, ...value } : f,
                        ),
                      });
                    return (
                      <div className="settings-entry" key={field.id}>
                        {text(
                          "Field label",
                          field.label,
                          (label) => edit({ label }),
                          80,
                        )}
                        <label>
                          Field type
                          <select
                            value={field.type}
                            onChange={(e) =>
                              edit({
                                type: e.target.value as typeof field.type,
                              })
                            }
                          >
                            <option value="text">Text</option>
                            <option value="textarea">Textarea</option>
                            <option value="select">Select</option>
                          </select>
                        </label>
                        <label>
                          Display order
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={field.order}
                            onChange={(event) =>
                              edit({ order: Number(event.target.value) })
                            }
                          />
                        </label>
                        {field.type === "select" && (
                          <label>
                            Select options (one per line)
                            <textarea
                              value={field.options.join("\n")}
                              onChange={(e) =>
                                edit({ options: e.target.value.split("\n") })
                              }
                            />
                          </label>
                        )}
                        <Toggle
                          label="Field enabled"
                          value={field.enabled}
                          change={(enabled) => edit({ enabled })}
                        />
                        <Toggle
                          label="Field required"
                          value={field.required}
                          change={(required) => edit({ required })}
                        />
                        <Reorder
                          index={index}
                          length={draft.productPage.customFields.length}
                          change={(dir) =>
                            update("productPage", {
                              customFields: move(
                                draft.productPage.customFields,
                                index,
                                dir,
                              ).map((f, order) => ({ ...f, order })),
                            })
                          }
                        />
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() =>
                            update("productPage", {
                              customFields:
                                draft.productPage.customFields.filter(
                                  (f) => f.id !== field.id,
                                ),
                            })
                          }
                        >
                          Remove field
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={draft.productPage.customFields.length >= 8}
                    onClick={() =>
                      update("productPage", {
                        customFields: [
                          ...draft.productPage.customFields,
                          {
                            id: crypto.randomUUID(),
                            label: "New field",
                            type: "text",
                            enabled: true,
                            required: false,
                            order: 7 + draft.productPage.customFields.length,
                            options: [],
                          },
                        ],
                      })
                    }
                  >
                    + Add Field
                  </button>
                  <p className="muted">
                    Up to 8 fields. Historical orders retain their original
                    labels and values.
                  </p>
                </section>
                <section className="panel settings-card">
                  <h2>Trust Badges</h2>
                  <Toggle
                    label="Enable Trust Badges"
                    value={draft.productPage.trustBadges}
                    change={(trustBadges) =>
                      update("productPage", { trustBadges })
                    }
                  />
                  {draft.productPage.badges.map((badge, index) => {
                    const edit = (value: Partial<typeof badge>) =>
                      update("productPage", {
                        badges: draft.productPage.badges.map((b) =>
                          b.id === badge.id ? { ...b, ...value } : b,
                        ),
                      });
                    return (
                      <div className="settings-entry" key={badge.id}>
                        {text(
                          "Badge label",
                          badge.label,
                          (label) => edit({ label }),
                          80,
                        )}
                        <label>
                          Badge icon
                          <select
                            value={badge.icon}
                            onChange={(e) =>
                              edit({
                                icon: e.target.value as typeof badge.icon,
                              })
                            }
                          >
                            {["cash", "truck", "shield", "return"].map(
                              (icon) => (
                                <option key={icon}>{icon}</option>
                              ),
                            )}
                          </select>
                        </label>
                        <Toggle
                          label="Badge enabled"
                          value={badge.enabled}
                          change={(enabled) => edit({ enabled })}
                        />
                        <Reorder
                          index={index}
                          length={draft.productPage.badges.length}
                          change={(dir) =>
                            update("productPage", {
                              badges: move(
                                draft.productPage.badges,
                                index,
                                dir,
                              ).map((b, order) => ({ ...b, order })),
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            update("productPage", {
                              badges: draft.productPage.badges.filter(
                                (b) => b.id !== badge.id,
                              ),
                            })
                          }
                        >
                          Remove badge
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={draft.productPage.badges.length >= 6}
                    onClick={() =>
                      update("productPage", {
                        badges: [
                          ...draft.productPage.badges,
                          {
                            id: crypto.randomUUID(),
                            label: "New badge",
                            icon: "shield",
                            enabled: true,
                            order: draft.productPage.badges.length,
                          },
                        ],
                      })
                    }
                  >
                    Add Badge
                  </button>
                  <p className="muted">
                    Add only statements your Store can fulfil.
                  </p>
                </section>
              </>
            )}
            {tab === "Navigation" && (
              <>
                {navigation("header")}
                <section className="panel settings-card">
                  <h2>Header CTA</h2>
                  <Toggle
                    label="Enable Header CTA"
                    value={draft.navigation.cta.enabled}
                    change={(enabled) =>
                      update("navigation", {
                        cta: { ...draft.navigation.cta, enabled },
                      })
                    }
                  />
                  {text(
                    "Header CTA Label",
                    draft.navigation.cta.label,
                    (label) =>
                      update("navigation", {
                        cta: { ...draft.navigation.cta, label },
                      }),
                    60,
                  )}
                  {destination(
                    draft.navigation.cta.target,
                    (target) =>
                      update("navigation", {
                        cta: { ...draft.navigation.cta, target },
                      }),
                    "Header CTA Destination",
                  )}
                </section>
                <section className="panel settings-card">
                  <h2>Social Links</h2>
                  {(
                    ["instagram", "tiktok", "facebook", "youtube"] as const
                  ).map((platform) => (
                    <div key={platform}>
                      {text(
                        `${platform[0].toUpperCase() + platform.slice(1)} URL`,
                        draft.navigation.social[platform],
                        (v) =>
                          update("navigation", {
                            social: {
                              ...draft.navigation.social,
                              [platform]: v || null,
                            },
                          }),
                        2048,
                      )}
                    </div>
                  ))}
                </section>
                {navigation("footer")}
              </>
            )}
          </fieldset>
        )}
      </div>
    </div>
  );
}
