# AfricaCod

An Africa-first cash-on-delivery commerce workspace. Checkpoint 1 provides **Account → Organization → Store → Add Markets**. Checkpoint 2 adds **Categories → Products → Product Media → Basic Variants → Market Offers**. Checkpoint 3 adds **Published COD product pages → Market-aware checkout → Orders inbox/detail**. Checkpoint 4 adds **CMS Pages → Store branding/navigation → Public store/category browsing → Apps discovery**. Checkpoint 5 adds **Confirmation → Callbacks → Manual Fulfillment → Shipment lifecycle → Operational metrics**. Checkpoint 6 adds **encrypted Store connections → provider mappings → durable handoff worker → status polling → manual fallback**, with a deterministic ShipCOD test adapter. Checkpoint 7 adds **Store-scoped tracking → asynchronous COD event delivery → idempotent Sheets test exports → lifecycle Analytics**. Checkpoint 8 completes **product UX audit → coherent merchant navigation → operational work queues → responsive storefront polish → anonymous visitor capture foundation**. **Production ShipCOD: BLOCKED pending official API documentation/access.**

A store starts with **zero markets**. Platform country definitions are reference data for a comprehensive country/territory catalog; only an explicit **Add Market** action creates a store market. Live couriers, AI, inventory, payments, settlement reconciliation, profit analytics and agency workflows remain deferred. External integration readiness and remaining credential requirements are listed under Checkpoint 7.

## Local setup

Requirements: Node.js 22+, pnpm 10.28.2, Docker with Compose. The Docker daemon must be running. Port 3000 is the web app; port 5433 is the local database.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
openssl rand -base64 32
```

Set `BETTER_AUTH_SECRET` in the root `.env` to the generated value, then:

```sh
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. All environment readers—including Drizzle CLI and the worker—find the repository root `.env` regardless of package working directory. Existing process environment variables take precedence. Validation runs when a database/auth configuration is used. Builds do not require a running database.

If `pnpm` is not on your PATH, `corepack pnpm` is equivalent. In restricted environments where `corepack enable` cannot write global shims, after installing dependencies use `corepack enable --install-directory node_modules/.bin`; Turbo finds the local shim.

## Test the checkpoint manually

1. Click **Get started**, enter your name, email, and a password of at least 10 characters, then **Create account**.
2. Create an organization, e.g. **Assia Commerce**. You become its **Owner**.
3. Click **Create your first store**. Enter **Glow Beauty** and an unused address such as `glow-beauty`. No country is requested.
4. Click **Create store**. The store detail must show **No markets yet** and **Add the countries where you want to sell.**
5. Click **Add Market**, search for and select **Kenya**, and click **Add selected market**.
6. Verify the row shows **Kenya / KES / en-KE / Active**. Reload; it persists.
7. Search for and add **Rwanda** (RWF/rw-RW), **Angola** (AOA/pt-AO), or **Ghana** independently. Kenya is no longer offered in the picker.
8. Click **Deactivate** for Kenya. Its row remains, marked **Inactive**. **Activate** restores the same record.
9. Sign out using the sidebar icon. Log in again and verify your stores.
10. In a separate browser profile, create another account/organization. Paste the first store URL; it must return the unavailable-page screen, with no store data.

## Commands and checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test` runs fast authentication-boundary, validation, country-catalog, money, and image-signature tests. `pnpm test:integration` applies the real migration and tests commerce operations against PostgreSQL. It requires `TEST_DATABASE_URL` to point to a database whose name ends in `_test`, and cleans up only its own tenant fixtures. Compose creates `africacod_test` on its first initialization. If you use an existing volume without that database, create it with `docker compose exec postgres createdb -U africacod africacod_test`.

The Playwright suite additionally covers the full Checkpoint 2 workflow with image upload, variant, Beauty/Hair assignment, Kenya/Ghana pricing, product-list persistence, mobile editor layout and foreign product/category/media denial. The original suite covers reload persistence, duplicate-picker prevention, searchable Kenya/Ghana/Rwanda/Angola selection, activation/deactivation, sign-out/login, authentication redirects, tenant URL isolation, and mobile layout. It creates uniquely named accounts/stores in the local app database and leaves them for inspection; use a disposable database in CI. It starts its own production server with explicit test-adapter settings, so run `pnpm build` before `pnpm test:e2e` and stop any existing server on port 3000 first. Reusing a development server is disabled to keep provider mode/encryption settings deterministic. On macOS versions unsupported by Playwright’s bundled Chromium, use an installed Chrome:

```sh
PLAYWRIGHT_CHROME_CHANNEL=chrome pnpm test:e2e
```

Generate a new migration after schema edits using `pnpm db:generate`. Apply migrations with `pnpm db:migrate`; the seed is idempotent and only inserts missing country definitions. It does not reset country settings or create store markets.

`pnpm build` runs the web production build and checks the reserved worker. Run `pnpm --filter @africacod/web start` to serve the production build. The worker is an idle, gracefully stoppable process with no background jobs at this checkpoint.

## Modules

| Module                | Responsibility                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | Next.js 16 App Router, landing, auth, onboarding, authenticated catalog screens, private media route and server actions |
| `apps/worker`         | Reserved worker entry point; no queues or business jobs                                                                 |
| `packages/db`         | Drizzle PostgreSQL schema, SQL migration, seed and Docker initialization                                                |
| `packages/domain`     | Organization/store/market/catalog operations with persisted-membership authorization                                    |
| `packages/auth`       | Better Auth email/password, session and client configuration                                                            |
| `packages/markets`    | Comprehensive ISO-based country/territory reference catalog                                                             |
| `packages/ui`         | Shared original branding, badges and page headings                                                                      |
| `packages/validation` | Zod input schemas; browser-supplied tenant/currency data are ignored                                                    |
| `packages/shared`     | Root environment loading and validation, currency-aware money utilities and default locale boundary                     |

## Schema and security

Fourteen tables: Better Auth `users`, `sessions`, `accounts`, `verifications`; business `organizations`, `organization_memberships`, `country_definitions`, `stores`, `store_markets`, `categories`, `products`, `product_media`, `product_variants`, `product_market_offers`.

- Membership roles: **Owner**, **Admin**. Organization creation and owner membership run in one transaction.
- A user can belong to multiple organizations. Only `(organization_id, user_id)` is unique, preventing duplicate membership within the same organization. The current UI continues to use the earliest membership (ordered by creation time, then membership ID) as its workspace; onboarding still creates the first organization for users without memberships. Invitations, organization switching, agency mode, and role-management UI are outside this checkpoint.
- All tenant-owned stores and markets carry `organization_id`. Server operations derive the organization from the authenticated user’s persisted membership. Browser IDs are resource selectors, never authorization evidence.
- Every store lookup and market read/update includes organization scope. Cross-tenant reads return a generic not-found result. Server actions authenticate separately from the route layout.
- A composite market foreign key `(store_id, organization_id)` references the same pair on stores, preventing database-level tenant mismatches.
- Public store identifiers are **globally unique** lowercase slugs (3–63 characters), with reserved names, validated at the boundary and enforced by PostgreSQL. These are identifiers; no public storefront is built yet.
- `(store_id, country_code)` is unique, including inactive records; deactivation is a status update, never deletion. Name, currency, locale, and calling code are snapshots from the selected country definition. These market-owned settings can evolve independently of reference data; the schema does not bind them to current catalog defaults.
- Stable market IDs link product offers and provide a future attachment point for address configuration, shipping, fulfillment and COD rules. Fulfillment and shipments now use independent lifecycle tables; markets remain merchant-selected.
- Better Auth owns password hashing and session cookies. No custom auth cryptography. Email verification/delivery, password reset, social login and two-factor authentication are outside this checkpoint. Authentication uses Better Auth’s in-process rate limiter; a shared limiter is not introduced for a single-process local checkpoint.
- English UI strings live in the web presentation layer; ISO codes and BCP 47 locales are data. No country-specific branching in the business service. A full translation catalog is deferred.

The catalog uses pinned MIT-licensed [countries-list 3.4.1](https://github.com/annexare/Countries): all 249 standard ISO 3166-1 countries/territories plus Ascension Island (AC), Tristan da Cunha (TA), and Kosovo (XK), for 252 entries. Supplemental codes are included explicitly and do not claim standard ISO assignment. The first listed currency and language provide defaults; locales use BCP 47 language-country tags. Existing ten-country defaults are preserved. Antarctica uses `XXX` (no currency), `en-AQ` as a fallback locale, and no calling code. Calling codes are nullable when unavailable. Defaults describe initial settings, not fulfillment availability. No country availability allowlist remains in the service.

The seed inserts reference definitions only, never StoreMarkets. Store creation inserts no markets regardless of catalog size. The searchable picker filters available countries by name or ISO code and excludes markets already attached to that store, including inactive markets.

Custom fallback UI is **deferred**. `CommerceService.addCustomMarket` prepares the authorized service boundary for a genuinely absent market: explicit name/currency/locale and optional calling code, with no global catalog insertion. Canonical names, native names, known aliases, and ISO alpha-2/alpha-3 codes must use catalog selection instead. Canonical markets retain `(store_id, country_code)` uniqueness; custom markets have a null country code and a normalized `custom_key`, unique per store even when inactive. A database check requires exactly one identity type. Stable IDs, editable snapshot columns, status preservation, and tenant constraints apply to both types. Market-specific configuration UI remains outside this checkpoint.

Reference implementations: [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Drizzle migrations](https://orm.drizzle.team/docs/migrations).

## Routes

Public: `/`, `/sign-up`, `/sign-in`, `/api/auth/[...all]`.
Authenticated: `/onboarding`, `/dashboard`, `/stores`, `/stores/new`, `/stores/[storeId]`, `/settings`, `/categories`, `/categories/new`, `/categories/[categoryId]`, `/products`, `/products/new`, `/products/[productId]`. Private image reads: `/api/media/[mediaId]` (401 when signed out, 404 for a foreign tenant).
Unauthenticated access redirects to sign-in. Accounts without an organization are redirected to onboarding. Mutation requests use Next.js server actions with input validation and membership authorization.

## CI

`.github/workflows/ci.yml` installs the frozen pnpm lockfile, starts disposable PostgreSQL, applies migrations/seeds, checks types/lint/format/unit/integration/build, and runs Chromium E2E. No external services beyond PostgreSQL are required. Secrets are injected through environment variables; `.env`, dependencies and generated browser reports are ignored by Git.

## Checkpoint 2: catalog and market offers

Products belong to a single Store. **Products and variants have no global price, currency, or cost.** Only `ProductMarketOffer` holds commercial values, keyed by `(product_id, store_market_id)`. A new product has zero offers, regardless of its store’s markets; product creation never creates markets or offers. Editing product information does not write offers. Each offer is saved independently so commercial changes are explicit; there is no bulk product/offer save transaction in this checkpoint.

Database guarantees:

- Store ownership uses composite `(store_id, organization_id)` foreign keys for categories and products.
- Categories support exactly two levels. `depth` and constant `parent_depth = 0`, a check constraint and composite parent FK require a same-store, same-organization **top-level** parent. Reparenting a category with children or incompatible product references fails at the database boundary. There is no hard-delete category action; status deactivation preserves references. Referenced categories cannot be deleted directly either.
- Product category/subcategory FKs require a top-level category and a subcategory whose actual parent is the selected category, all within the same Store and organization.
- Product slugs are unique within a Store. Optional product SKUs are trimmed, uppercase and unique per Store; blank SKUs become NULL so multiple unspecified SKUs are allowed. Variant SKUs follow the same normalization and are unique per Product. Product SKU and variant SKU are distinct namespaces; no inventory or global SKU registry is implied.
- Offers carry a redundant `store_id` so composite FKs enforce Product → StoreMarket consistency for both Store and organization. They reference only StoreMarkets actually selected by the merchant, never country definitions. Currency is snapshotted from the persisted StoreMarket under a transaction lock and ignored from browser input. Changing reference catalog data does not rewrite offers.
- Offer amounts are PostgreSQL `bigint` integer minor units bounded by JavaScript’s safe integer maximum. Selling price must be positive, compare-at must be at least price, and cost must be nonnegative. Shared money utilities parse decimal **strings** with BigInt and reject extra decimals rather than round them. Pinned ISO 4217 currency metadata supplies each currency’s decimals: KES/GHS have two, RWF/JPY zero, KWD three. `XXX`/`XTS` cannot be priced.
- StoreMarket deactivation retains offers. Saving an active offer requires an active StoreMarket. Dashboard active-offer totals count active offers in active StoreMarkets; product status remains an independent catalog attribute, not a publishing operation.
- Media and variants use composite Product/organization FKs. All reads, uploads, edits, removes and reorders authorize persisted organization membership. Media order changes validate the exact set of owned product images and run transactionally.

### Run the Glow Beauty workflow

1. Sign in and open **Glow Beauty**. Explicitly add **Kenya** and **Ghana** if not already selected.
2. Open **Categories** for that Store; add **Beauty**. Use its **Add subcategory** link to create **Hair** beneath Beauty.
3. Open **Products → Add Product**, choose Glow Beauty, enter **Hair Growth Serum** with SKU `SERUM-001`, assign **Beauty → Hair**, and create it. Its initial status is Draft unless selected otherwise.
4. Upload an image and add simple variants such as **50 ml** and **100 ml**. Save the product information separately when editing it.
5. In **Markets & pricing**, expand Kenya, enter price `3990`, compare-at `4990`, cost `1200`, and save. Stored values are `399000`, `499000`, `120000` KES minor units.
6. Configure Ghana with price `399`, compare-at `499`, cost `120`, and save. Stored price is `39900` GHS minor units.
7. Return to Products. The row shows Hair, SKU and both configured market offers. Reload to verify persistence.

Only this Store’s actual markets appear in pricing. Zero-market stores show **“No markets configured for this store.”** and **“Add a market”** linking back to Store Markets; the product screen never adds one implicitly. Inactive markets stay visible with their state. Categories and product lists provide store selection, search, statuses and empty states; product filters use query parameters.

### Media storage

`MediaStorage` defines provider-neutral `put`, `read`, and `remove` operations. `CatalogService` receives that interface rather than a provider SDK. The web app injects a local filesystem implementation, defaulting to the web app’s ignored `.data/media` directory (`apps/web/.data/media` when using the workspace start/dev scripts). PNG, JPEG and WebP files are limited to 10 MB and validated against content signatures and claimed MIME types; SVG and arbitrary URLs are excluded. Preview reads go through the authenticated private media route, with no public file directory and no shared cache. Image processing/resizing and malware scanning are not implemented.

Local files require a persistent single-host disk. For production or multiple app instances, implement the same interface with durable S3-compatible storage (e.g. Cloudflare R2), inject it in place of `localMediaStorage`, and keep object keys private. No S3/R2 integration or credentials are introduced now. Failed database uploads clean up their newly written object. Failed physical removal can leave an inaccessible orphan after metadata deletion; an orphan cleanup job is deferred. Product media upload, preview, removal and move-earlier/move-later reordering are implemented.

Deferred: variant-specific market pricing, inventory and option combinations; rich text editing; category deletion; external storage adapters and media processing; Fulfillment, analytics, AI and external integrations. Variants are descriptive product versions only; every market offer applies to the whole Product.

## Checkpoint 3: published COD storefronts and Orders

One `cod_v1` ProductPage per Product stores separate draft and published JSON configurations. Save the draft, preview it at `/products/{productId}/preview`, and explicitly publish or unpublish. Publishing snapshots product name/description, configured text and media ordering; later draft or product edits do not modify live content. Published images cannot be removed until excluded by a new publication or the page is unpublished. Prices and active variants remain live catalog data.

Public URLs are `/s/{storeSlug}/p/{productSlug}?market=KE` (or `GH`). Only active same-store markets with active, currency-matching offers are selectable. No catalog country becomes a market automatically. One eligible offer selects automatically; multiple offers require selection. Invalid/inactive/unconfigured market parameters show a selection state with no substitute price or checkout. Custom markets use `market=custom:{customKey}`. Active Store, active Product and published ProductPage are required.

### Manual end-to-end check

1. Sign in, create Glow Beauty, and explicitly add Kenya and Ghana.
2. Create active Hair Growth Serum. Upload an image and add a descriptive variant if desired.
3. Save Kenya offer at **3,990 KES** and Ghana offer at **399 GHS**, with any private costs.
4. Configure headline, subtitle, benefits, trust message, CTA and media ordering. **Save storefront draft**, preview, then **Publish storefront**.
5. Open the public link with `?market=KE` on a mobile viewport. Fill customer name, valid Kenyan phone (e.g. `0712345678`), County, City / town and Delivery address; submit quantity one.
6. The receipt shows an order reference and **KES 3,990.00**. `/orders` and `/orders/{orderId}` show the same customer, Kenya market and immutable item/commercial snapshots.
7. Open `?market=GH`; it shows **GHS 399.00**, Ghana phone rules and Region label. Edit the product or offer and verify the earlier order is unchanged.

### Checkout rules and persistence

The anonymous JSON POST `/api/storefront/{storeSlug}/{productSlug}/checkout` requires a client-generated UUID `Idempotency-Key`. The browser retains it across retries and generates a new key for another intentional order. A transaction-scoped advisory lock and unique `(store_id, checkout_idempotency_key)` serialize concurrent retries. Identical normalized commercial details return the original receipt; changed details with that key return 409. Attribution and browser-submitted prices are excluded from the request fingerprint. A successful retry still returns its original receipt after unpublishing; a new order requires current eligibility.

Server lookup determines the Store, Product, StoreMarket, offer, currency, unit price and totals. Client price/currency fields are ignored. Quantities are 1–20; exact integer minor-unit arithmetic is bounded by JavaScript’s safe integer range. Delivery fee is zero for this checkpoint; there is no shipping calculation engine or online payment. Checkout creates a commercially `new` Order. Checkpoint 5 adds explicit confirmation/cancellation and separate manual fulfillment/shipment workflows.

A single PostgreSQL transaction creates/upserts the store-scoped normalized-phone Customer, Order, one OrderItem, initial OrderEvent and OrderAttribution. Order and item snapshots include customer/address, country/market, currency, product/variant names, SKU, selling price, private cost, quantity and totals. Validation failure persists nothing. Same phone + same Product + same StoreMarket within 24 hours flags a possible repeat, including cancelled orders; it never rejects a new intentional purchase. Customer updates cannot change historical order snapshots.

`checkout-configuration.ts` is the reusable country/market boundary. Pinned `libphonenumber-js/max` metadata normalizes and validates phone numbers. Kenya requires County and Ghana requires Region; both require city and delivery address. Other catalog countries use phone metadata with generic address defaults, and nullable StoreMarket `checkout_config` can override the whole configuration for future market requirements. Custom/unsupported-phone territories require valid international numbers. Detailed country-specific address rules and their merchant settings UI are deferred.

Migration `0004_cod_storefront_orders.sql` adds six tables: `product_pages`, `customers`, `orders`, `order_items`, `order_events`, `order_attribution`, plus StoreMarket checkout configuration and supporting identity constraints. Composite tenant/store/market/product/variant/offer/currency FKs protect relationships; checks enforce amounts, normalized phones, template and publication state. Customer uniqueness is `(store_id, normalized_phone)`. Order idempotency is store-scoped. There is no global Product price or automatic market creation.

Public media is served only from the currently published page at `/s/{storeSlug}/p/{productSlug}/media/{mediaId}`. Other media remains authenticated at `/api/media/{mediaId}`. Public DTOs and checkout receipts omit private cost, organization IDs, storage keys and unselected-market prices. Authenticated Orders lists/details include tenant-scoped snapshots, attribution and timeline. Filters cover store, market, status, UTC date range and reference/name/phone search with 20-row pagination. Checkpoint 3 initially showed Orders, New Orders and New Order Value. Checkpoint 5 replaces those operational cards with lifecycle counts and snapshot-based Delivered Revenue grouped by currency; no cross-currency sum or profit metrics.

Attribution captures UTM source/medium/campaign/content/term, fbclid, optional fbp/fbc, referrer, landing URL and server user agent. These are informational strings; no advertising API or Purchase event is sent. Same-origin JSON requests are required by the web boundary. Production abuse controls and external storage/media processing remain future deployment work.

Tests cover publication isolation, eligibility, Kenya/Ghana prices, private-field projection, server price authority, concurrent idempotency, legitimate repeats, historical snapshots, rollback on invalid phone/address/variant, composite FKs, tenant denial, search/date/pagination and unpublish/retry behavior. Playwright covers merchant publication, draft preview, anonymous mobile media/selector/phone keyboard/validation/loading/double-submit/success, Kenya Orders snapshots/attribution and Ghana rendering. The Checkpoint 3 workflow remains covered by its original tests.

## Checkpoint 4: CMS Pages and the public store

Generic **Pages** belong to a Store and are separate from ProductPages. Authenticated routes are `/pages`, `/pages/new`, `/pages/{pageId}` and `/pages/{pageId}/preview`. Create a draft, add a title, store-scoped address, content and optional SEO metadata, then explicitly **Publish page**. **Unpublish page** immediately removes public access and navigation while retaining the draft and previous snapshot. Save never publishes automatically.

The editor supports paragraphs, H2/H3, bold, italic, bullet/numbered lists and links using a small Markdown subset with formatting controls and a formatting preview. HTML is displayed as ordinary text. Links allow HTTP/HTTPS and local absolute paths; JavaScript/data/protocol-relative links do not become anchors. This is a focused informational-page editor, with no page builder, AI writer or arbitrary HTML execution.

Publication snapshots the title, address, content, meta title/description and navigation preferences. Editing any of these draft fields leaves the live page unchanged until republished. Draft addresses are unique by `(store_id, slug)`; a separate unique published address protects existing public URLs while merchants change a draft address. Publishing an address already used by another published page returns a conflict. Unpublishing releases the published address. Pages cannot move between stores.

Published pages appear at `/s/{storeSlug}/pages/{pageSlug}` only when the Store is active. Enable **Show in navigation when published**, optionally change the navigation label and order, then publish to include a page in the store header. About/Contact are examples, not hardcoded navigation entries. SEO metadata reads the published snapshot, never draft values.

### Public storefront routes and behavior

- `/s/{storeSlug}?market=KE` — public store home.
- `/s/{storeSlug}/products?market=KE` — product grid, bounded to 24 products per page.
- `/s/{storeSlug}/categories?market=KE` — existing active two-level category hierarchy.
- `/s/{storeSlug}/category/{categorySlug}?market=KE` — parent category includes its subcategory products; a subcategory filters its own products.
- `/s/{storeSlug}/pages/{pageSlug}` — published informational page.
- `/s/{storeSlug}/logo` — validated logo image for an active Store.
- Existing `/s/{storeSlug}/p/{productSlug}?market=KE` — published COD product page and checkout.

One coherent storefront shell provides Home, Products, Categories and merchant-selected published Pages. Navigation carries the market parameter; the market selector changes the shareable URL and resets pagination. Only explicit active StoreMarkets appear; a store still starts with zero markets. One active supported-currency StoreMarket selects automatically. Multiple markets require customer selection. An invalid/inactive market stays unavailable without switching to another market. No country/IP inference is performed. An active market with no eligible products shows an empty state.

Grids show products only with an active Product, a published ProductPage and an active same-store, same-market currency-matching ProductMarketOffer. Product card names, subtitles and image order come from the published ProductPage snapshot. Prices remain authoritative current market offers; private costs, drafts, tenant IDs, storage keys and unselected-market prices are omitted. Inactive parent categories also hide their subcategories from browsing. Product grids retain the existing Product/Offer/Category architecture. Store/Product/CMS routes have basic Next.js title/description metadata.

**Store branding** on the Store detail lets merchants edit name, optional tagline and public contact email/phone and upload a logo. Branding edits do not change the store address or create markets. Logo uploads use the established 10 MB PNG/JPEG/WebP signature checks and provider-neutral MediaStorage boundary. Runtime files remain outside public assets. The public logo route checks Store activation; responses are not cached. Replacing a logo removes the previous object after the database update. No arbitrary external logo URL is accepted. External storage adapters, resizing and advanced themes remain deferred.

### Apps foundation

`/apps` is authenticated discovery, organized into Marketing, Data, Communication and Fulfillment. Meta, TikTok, Google Ads, Google Sheets and WhatsApp remain **Coming soon**. Checkpoint 6 replaces the fulfillment placeholder with ShipCOD, COD in Africa, WeGoo and Haulstow. Only ShipCOD has a configuration framework; it is labeled **Available (test adapter)** only under explicit test mode. Production remains blocked; all other providers remain Coming soon.

The immutable platform app catalog has stable IDs, categories and descriptions. AppsService validates organization membership and optional Store ownership. Store-scoped ShipCOD connection status comes from server-owned configuration, with credentials omitted from browser DTOs. Planned entries never pretend to connect.

### Schema, checks and manual verification

Migration `0005_storefront_cms_branding.sql` adds `content_pages`, its independent draft/published enum, tenant/store composite FK, store-scoped draft and published-address uniqueness, publication checks, navigation fields and index. Store gains optional tagline/contact fields and reuses its existing logo field for validated storage keys. There are now 21 tables; ProductPages, Orders, pricing and merchant-selected markets are unchanged.

1. Sign in and open Glow Beauty with Kenya/Ghana and its published Hair Growth Serum offers.
2. Save Store branding and optionally upload a logo.
3. Open **Pages**, choose Glow Beauty, create **About Glow Beauty**, add formatted content, SEO text and enable navigation.
4. Preview the saved draft, then publish it.
5. Open `/s/{storeSlug}?market=KE`. Verify branding, About navigation and Hair Growth Serum at **KES 3,990.00**. Open the About page and verify its published content.
6. Edit and save the CMS draft; refresh the public page and verify content/SEO/navigation have not changed.
7. Open `?market=GH`; verify **GHS 399.00**. Browse Beauty → Hair, open the product card and complete the existing Kenya COD checkout. The order appears in Orders with its original snapshots.
8. Open **Apps** and verify planned integrations remain Coming soon. ShipCOD opens its clearly labeled configuration/production-blocked screen.

New tests cover CMS creation/publication/unpublication, frozen title/address/SEO/navigation snapshots, draft and public address conflicts, independent stores, tenant denials, branding/logo validation, active-market/offer/publication filtering, category hierarchy and public privacy. Parser unit tests cover all supported formatting and unsafe links/HTML. Browser coverage verifies branding/logo, CMS formatting and metadata, navigation, private draft edits, Kenya/Ghana grids, category/product browsing, Apps status and COD-to-Orders regression. Existing Checkpoint 1–3 tests remain in the full quality gate.

Deferred beyond the implemented checkpoints: live external couriers, other external app integrations/OAuth, WhatsApp messaging, advertising APIs/events, AI, profit analytics, inventory, payments and agency mode. Also deferred are an advanced theme/page builder, full Markdown syntax, CMS deletion/search tooling and production storage/abuse controls. The storefront/CMS/Apps foundation remains independent of manual order operations.

## Checkpoint 5: confirmation and manual logistics

Commercial Order status is **new → confirmed** or **new → cancelled**. Confirmation records `confirmed_at`; cancellation requires a reason (`customer_cancelled`, `invalid_order`, `duplicate`, `merchant_rejected`, `unreachable`, `other`), records `cancelled_at` and retains the reason. Confirmed Orders cannot be cancelled/reversed by this simple workflow. Logistics never overwrite commercial status.

Confirmation attempts record the acting membership, outcome, note, attempt time and optional callback time. Derived confirmation state is calculated from Order status and the latest attempt: terminal commercial state wins; no attempts means **uncontacted**; a due latest callback means **callback_due**; otherwise attempts mean **attempted**. A future callback remains attempted with an upcoming callback time. A later attempt supersedes an old callback. Callback is not a persisted second confirmation status. Times in operator forms and queues are explicitly UTC; overdue is more than a minute late, due now is within the most recent minute, upcoming is in the future. No background notifications exist.

Confirmation locks the Order and atomically inserts the attempt, updates commercial state/timestamps and appends its Order event. Attempt request keys are unique per Order, checked against a payload hash, and rotate after success in the UI. Retrying an identical request or concurrently confirming twice does not duplicate side effects. Other attempts on a terminal Order are rejected. Assignment is optional, restricted to the same organization's persisted memberships, and editable only while the Order is new.

### Screens and operator workflow

- `/orders` preserves search, Store/Market/date filters and 20-order pagination; adds commercial status, derived confirmation state, fulfillment/shipment states, assigned agent and callback filters.
- `/orders/confirmation` offers all five confirmation views, quick No answer/Confirm actions, and links to callback/cancellation/assignment detail.
- `/orders/callbacks` shows all scheduled callbacks, ordered by time; filter overdue/due now or upcoming.
- `/fulfillment` lists confirmed Orders, including those without Fulfillment. Filter Awaiting fulfillment, Ready, Processing, Failed or Fulfilled. Create fulfillment, then create a manual shipment directly or add optional tracking on Order detail.
- `/orders/{orderId}` keeps customer/items/commercial/attribution snapshots and adds confirmation attempts, assignment, callbacks, fulfillment, manual Shipment and a timeline distinguishing Order/Confirmation/Fulfillment/Shipment events.
- `/dashboard` reports real Orders, awaiting confirmation, Confirmed, Cancelled, Callback Due/upcoming, Ready for Fulfillment, Shipped, Out for Delivery, Delivered, Refused and Returned counts, plus **Delivered Revenue** grouped by currency. Shipped/Delivered/Refused/Returned counts reflect current Shipment status. Ready includes confirmed Orders without Fulfillment and ready Fulfillments.

One manual Fulfillment is allowed per confirmed Order. Creation starts **ready**. Its normalized statuses are pending/ready/processing/fulfilled/failed/cancelled. Operator transitions: pending → ready/cancelled; ready → processing/cancelled; processing → failed/cancelled; failed → processing/cancelled. Creating a Shipment atomically marks Fulfillment **fulfilled** and records both histories. Fulfilled means a Shipment was produced, never delivered. Failed fulfillment must return to processing before creating a Shipment; fulfilled/cancelled fulfillment is terminal.

A single Shipment belongs to that Order/Fulfillment. `provider_key=manual`; optional HTTP/HTTPS tracking URL and tracking number can be supplied. Creation requires a confirmed Order and eligible Fulfillment. An identical creation retry returns the existing Shipment; conflicting tracking data is rejected. Valid logistics transitions are:

```text
created → shipped → out_for_delivery → delivered
created → cancelled
out_for_delivery → delivery_failed → out_for_delivery
out_for_delivery → refused → returned
shipped → returned
delivery_failed → returned
```

Delivered, Returned and Cancelled are terminal. Retrying the same current status adds no duplicate event. Every creation/transition appends a manual Shipment event; shipment/fulfillment transitions never change Order status. No arbitrary status dropdown or external courier calls exist.

Delivered Revenue sums the original `orders.total_minor` only for delivered Shipments, once per Order, separately by currency. Submitted, confirmed, shipped, refused and returned Orders contribute no Delivered Revenue. Editing a current ProductMarketOffer cannot change historical Order economics. This is revenue from delivered COD orders, not collected/settled cash or profit.

### Schema, permissions and provider boundary

Migration `0006_order_operations.sql` extends `order_status`, adds assignment/confirmed/cancelled/reason fields and creates `confirmation_attempts`, `fulfillments`, `fulfillment_state_events`, `shipments`, `shipment_events` (26 tables total). Composite membership/Order/Fulfillment/Shipment foreign keys prevent foreign-tenant assignment and mismatched relationships. Unique keys enforce one Fulfillment and Shipment per Order and retry keys per attempt. Database triggers reject fulfillment/shipment writes against unconfirmed Orders and reject updates to attempt/Order/Fulfillment/Shipment history. Operational service APIs only append history; no history update/delete endpoint exists. Explicit database-admin retention/fixture deletion remains possible.

Existing **Owner/Admin** permissions cover assignment, confirmation and manual fulfillment. Both derive authorization from persisted membership on every service/action. No new agent role or invitation/RBAC UI is introduced; a dedicated restricted Confirmation Agent role is deferred until member administration exists. Cross-tenant Order detail, attempts, fulfillment/shipment access, assignment and events are rejected by service boundaries and composite constraints.

Checkpoint 6 now supplies the provider-neutral adapter boundary under `packages/domain/src/integrations/providers`. `ShipmentProvider` remains a type alias for compatibility. Manual workflows still use the same Order/Fulfillment/Shipment state machines.

### Verification

New unit tests cover derived confirmation state, callback timing and terminal/retryable logistics rules. Integration tests cover attempt idempotency, callbacks and superseding schedules, atomic confirmation/history, reasoned cancellation, assignment isolation, fulfillment preconditions/uniqueness/failure recovery, shipment preconditions and transitions, immutable history updates, tenant constraints and snapshot-based Delivered Revenue. Browser coverage creates a Kenya COD order, records No Answer/Callback, checks its overdue queue, confirms, creates manual fulfillment/shipment, advances to Delivered and verifies original KES 3,990.00 revenue. It changes the current offer to KES 4,490.00, then confirms and returns a second Order through Refused → Returned; both commercial Orders remain confirmed and delivered revenue stays unchanged. All Checkpoint 1–4 tests remain in the quality gate.

Deferred: live couriers, documented provider webhooks, WhatsApp automation, advertising/Google integrations, AI, inventory, payments, settlement reconciliation, profit analytics and agency mode. Separate Analytics/breakdowns, dedicated agent RBAC/member administration, fulfillment reversal and confirmation reversal are also deferred. Checkpoint 5 stops at manual operational lifecycle workflows.

## Checkpoint 6: provider fulfillment framework

**Production ShipCOD is BLOCKED pending official API access/documentation.** The account owner has no API material. ShipCOD’s [official FAQ](https://shipcod.delivery/faq/) verifies coverage in **Kenya, Uganda and Tanzania**, checked 2026-10-02. Coverage is the only verified provider behavior used here. We have no verified shipment endpoint, authentication format, product-ID format, request/response schema, idempotency guarantee, raw status vocabulary or webhook authentication contract. No production endpoints or webhook contracts have been fabricated, and no request reaches ShipCOD.

The implemented adapter is a **deterministic test fixture**. Its API key/secret are `mock-key` / `mock-secret`, its external IDs start `test-shipcod-`, and its tracking numbers start `TEST-`. It runs only when **both the web process and worker** explicitly set `PROVIDER_TEST_MODE=1`. The default is `0`; production configuration is rejected, and the production adapter fails closed. Test controls appear only in test mode and require authenticated tenant access. Do not use test mode for a live merchant store.

### Connection and mapping

Migration `0007_provider_fulfillment.sql` adds seven tables: `provider_connections`, `provider_connection_markets`, `provider_product_mappings`, `provider_jobs`, `provider_attempts`, `provider_status_events`, and `provider_test_shipments` (33 total). Existing Fulfillment/Shipment records gain optional provider relationships and synchronization metadata. Composite tenant/store foreign keys and provider relationship triggers enforce ownership. Status-event history is append-only. Products have no ShipCOD-specific columns.

Apps → ShipCOD selects a Store, saves API key/secret, explicitly enables existing active StoreMarkets and queues a connection test. Saving resets validation; the worker validates the saved revision before Connected (test adapter) can appear. Credentials use AES-256-GCM with random nonces, a versioned envelope and organization/Store/connection associated data. A separate **32-byte base64 `PROVIDER_CREDENTIALS_KEY`** is mandatory for credential operations; generate it with `openssl rand -base64 32`. Keep it in the server/worker environment, preserve it across restarts and back it up securely. There is no auth-secret fallback or key rotation UI. Browser responses omit ciphertext and secrets; saved password fields are blank. Leaving both fields blank retains the encrypted values. Failure messages and logs omit credentials and provider request/response payloads.

Provider enablement never creates StoreMarkets. Ghana and any other catalog/custom market remain valid Store markets regardless of ShipCOD coverage. Unsupported/inactive markets cannot be enabled for this adapter. Provider product IDs/SKUs are saved in connection-scoped mappings; an optional variant mapping overrides the base product mapping. Source tracking is a **mock-only snapshot option**; real support is unverified. No live test-order action is offered.

### Handoff and recovery

Checkout always creates a commercially `new` Order without provider jobs. Confirmation also does not send it. An operator must create Fulfillment, review market/connection/mapping/customer checks, and choose **Send to ShipCOD**. The browser commits a durable PostgreSQL job and immutable commercial/customer/mapping snapshot; the worker makes the adapter call afterwards. Offer or mapping edits do not change a queued snapshot. One creation request key per Fulfillment survives retries. The existing unique Order/Fulfillment/Shipment constraints prevent duplicate local Shipments.

Run the worker separately with the same environment as the web app:

```sh
pnpm --filter @africacod/worker dev
# Process at most one available job and exit, for diagnostics:
pnpm exec tsx apps/worker/src/index.ts --once
```

`pnpm dev` starts web and worker through Turbo. Jobs have committed attempt records, two-minute leases and session advisory locks held across adapter calls. Concurrent workers cannot claim the same call; a crashed session releases its lock. The test adapter persists idempotency results separately, so a crash after a simulated remote response reuses the same external shipment. Expired attempts are recorded as unacknowledged failures before recovery. A future adapter without verified remote idempotency must put an ambiguous creation into **investigation**, never blindly retry it. The production adapter remains disabled until that contract is settled.

Known failures pause the job with a safe error. **Retry ShipCOD handoff** explicitly requeues the same request/snapshot; **Use manual fulfillment** cancels a pending/failed job before restoring manual mode. Processing, completed or uncertain remote creates cannot fall back automatically because a shipment might already exist. Investigation requires operator reconciliation; no speculative force-reset action is implemented. Disconnected/invalid/unsupported/unmapped orders can still use the unchanged manual workflow. Provider Shipments cannot be edited with manual status buttons. Orders remain confirmed throughout independent delivery states.

### Status synchronization

No webhook route is implemented without a documented authenticity contract. The adapter exposes status lookup instead. The worker polls nonterminal Shipments every **30 minutes**; an authenticated **Sync provider status** action can request an earlier check. Delivered, returned and cancelled Shipments are never polled. The job resolves tenant ownership from stored connection/Shipment relationships. Normalized changes must follow the existing Shipment transition graph, append a ShipmentEvent and retain raw status plus synchronization metadata. Provider events deduplicate by connection/event identifier; provider response identifiers must match the stored Shipment.

These mappings describe **mock fixtures only**, not real ShipCOD statuses:

| Raw fixture status      | Internal Shipment status |
| ----------------------- | ------------------------ |
| `mock_created`          | `created`                |
| `mock_shipped`          | `shipped`                |
| `mock_out_for_delivery` | `out_for_delivery`       |
| `mock_delivery_failed`  | `delivery_failed`        |
| `mock_delivered`        | `delivered`              |
| `mock_refused`          | `refused`                |
| `mock_returned`         | `returned`               |
| `mock_cancelled`        | `cancelled`              |

Unknown raw values and known values that would skip/violate a transition are preserved in status events with an investigation disposition and safe error. They do not change the normalized Shipment or Order. Acknowledged duplicate events do not append duplicate ShipmentEvents or delivery revenue. Once an investigation is resolved, another status lookup can process a valid transition; uncertain shipment creation still requires reconciliation. Debug tables contain identifiers/statuses only, not customer payloads; only the necessary handoff snapshot contains customer delivery data.

### Verification and limits

Provider unit/integration tests cover authenticated encryption, default production blocking, valid/invalid credentials, secret omission, explicit Kenya enablement, Ghana rejection, mapping requirements, confirmed-only handoff, immutable price snapshots, crash recovery/idempotency, failed attempts/retries, polling/duplicate events, unknown/invalid transitions, terminal behavior, manual fallback and cross-tenant read/edit/use/trigger denials. The browser scenario runs the real worker process against the deterministic adapter: Glow Beauty → Kenya → Hair Growth Serum mapping → COD checkout → confirmation → queued handoff → created/shipped/out-for-delivery/delivered. It changes the offer after checkout and verifies **original KES 3,990 Delivered Revenue**, plus a failed handoff followed by manual recovery. Playwright supplies explicit test mode and an isolated fixture encryption key to its child web/worker processes; production credentials are unnecessary.

Before a live ShipCOD release, obtain official account/API material, verify credentials and coverage, implement the real create/status contract, settle remote idempotency and ambiguous-create reconciliation, document actual raw status mappings, and add authenticated webhooks only if documented. COD in Africa, WeGoo and Haulstow remain catalog entries only. No second provider, agency mode, Products changes, payments or settlement logic is added in this checkpoint.

Checkpoint 6 local validation: all seven quality gates passed (`typecheck`, `lint`, `format:check`, `test`, `test:integration`, `build`, `test:e2e`): **29 unit tests, 88 PostgreSQL integration tests and 9 browser tests**, including all previous checkpoint scenarios. Browser tests used installed Chrome on this macOS host. A fresh disposable database migration also produced all 33 tables successfully.

## Checkpoint 7: COD tracking, order exports and lifecycle Analytics

Tracking is **disabled by default**, selected separately for every Store in Apps. Creating a Store still creates **zero markets and zero integration connections**. Browser settings contain account identifiers only; secrets are AES-256-GCM encrypted with tenant/Store/connection/provider associated data. Generate a separate 32-byte base64 `INTEGRATION_CREDENTIALS_KEY` using `openssl rand -base64 32`, supply it to web and worker, and preserve it across restarts. Saved token inputs remain empty; blank retains the encrypted token. `TRACKING_TEST_MODE=0` is the default. Only an explicit `1` in both web and worker enables local deterministic adapters; never enable it on a live store.

Migrations `0008_tracking_commerce.sql`, `0009_commerce_event_integrity.sql` and `0010_tracking_health.sql` add six tables (39 total): `tracking_connections`, `commerce_events`, `tracking_jobs`, `tracking_attempts`, `tracking_test_receipts`, `sheets_test_rows`. Composite foreign keys protect organization/Store identity, unique connection/event constraints deduplicate jobs, and commerce event history cannot be edited. Store/order relationships are additionally checked by a database trigger. Reference country data still never creates StoreMarkets.

### Event policy and worker

Provider-neutral internal events include `product_viewed`, `checkout_submitted`, `order_created`, `order_confirmed`, `shipment_created`, `shipment_shipped`, `shipment_out_for_delivery`, `shipment_delivered`, `shipment_refused`, and `shipment_returned`. Other state changes use `shipment_changed` for export refreshes. Published product view requests persist minimal IDs/time; views are observational and are **not** used to infer reliable visitor conversion rates. Existing committed, immutable OrderEvents and ShipmentEvents are the durable source outbox: the worker materializes them in bounded replayable batches. Checkout and operational transitions make **no external tracking call**. Worker outages never roll back an Order or delivery; replay recovers committed histories after restart. Materialized event IDs remain stable.

Meta browser sends PageView/ViewContent only when the Store opts in, then Lead after a successful valid checkout. CAPI sends the matching Lead with `event_id=checkout:<Order Number>`, also used by browser `eventID`. No value or Purchase is sent for submission, confirmation or shipping. Merchant Purchase mode has exactly two options: **On Delivered** or **Disabled**. A delivered event sends Purchase only if current Shipment truth remains delivered and the connection opts in. The value/currency come from the immutable Order snapshot: editing a Kenya offer after a KES 3,990 order cannot change its Purchase or delivered revenue.

Connections and jobs are revisioned. Saving settings cancels stale queued revisions and applies to events occurring **after the save**; there is no historical marketing backfill. Disablement prevents pending sends. Jobs are claimed with PostgreSQL row locks and `SKIP LOCKED`; a transaction owns the attempt across an external call, and process termination releases it for replay. Completed/failed attempts store safe outcomes, never payloads or tokens. Network requests have an eight-second timeout and up to five attempts with exponential delays. Retry IDs remain unchanged. Meta requests older than 48 hours are rejected locally to keep retries inside the documented deduplication window (stricter than the provider's seven-day ingestion maximum). Terminal failures are inspectable in Apps; no automatic unbounded retry or force-resend action exists. In-flight requests already accepted by a provider cannot be recalled by disabling a connection.

Meta sends only normalized SHA-256 phone matching data, available fbp/fbc, user agent and source URL with its query stripped. fbclid derives fbc when no saved fbc exists. Names, addresses, costs, referrers and UTMs are not sent to Meta; UTMs remain in internal attribution/Sheets. Checkout Lead uses `action_source=website` with required URL/user-agent context. COD delivery Purchase uses `action_source=other` because delivery completes away from the browser. Health exposes only event type, status, attempts, safe error and mock event/value/currency facts. It never exposes customer match hashes or raw provider responses.

### External readiness

| Integration                      | Result      | Implemented / remaining setup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Meta                             | **PARTIAL** | Production Pixel and asynchronous CAPI transport implemented against official contracts; deterministic CI verifies COD mapping, browser/server dedupe IDs and retries. Merchant must supply a numeric Pixel ID and authorized CAPI token, configure/verify the storefront domain and validate real events/deduplication in Meta Events Manager. No live account/credential validation was performed. Connected requires a successful CAPI receipt; browser initialization alone is not proof of delivery.          |
| TikTok                           | **PARTIAL** | Official browser loader and PageView/ViewContent/SubmitForm foundation implemented; submitted COD never maps to Purchase or CompletePayment. Merchant supplies Pixel ID and verifies receipt in TikTok Events Manager. Server Events API deferred; no invented endpoint or authentication.                                                                                                                                                                                                                         |
| Google Ads                       | **PARTIAL** | Official browser gtag lead conversion foundation with merchant `AW-…` tag ID and lead action label; no submitted monetary value. A separate delivered label is reserved in configuration but never fires on submission. Merchant must create distinct conversion actions and verify account/domain/tag setup. Authorized server/offline delivered conversions are deferred.                                                                                                                                        |
| Google Sheets                    | **PARTIAL** | Encrypted connection boundary, Store destination and deterministic idempotent export adapter are usable in explicit test mode. Production is blocked pending a Google Cloud project with Sheets API enabled, OAuth consent/client/redirect setup, merchant authorization with spreadsheets scope, encrypted refresh/access tokens, spreadsheet ID/tab and write permission. OAuth authorization, token refresh and production row transport are deferred; no fake authentication or actual Google request is made. |
| ShipCOD                          | **BLOCKED** | Checkpoint 6 test adapter remains available only in explicit provider test mode; real API documentation/account access remains unavailable.                                                                                                                                                                                                                                                                                                                                                                        |
| COD in Africa / WeGoo / Haulstow | **BLOCKED** | Coming soon; no second courier implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Verified official references, checked 2026-10-02: [Meta base Pixel](https://developers.facebook.com/documentation/meta-pixel/get-started), [conversion events](https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking/), [browser/server deduplication](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/), [CAPI requests](https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api/), [server parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event/), [TikTok Pixel loader](https://ads.tiktok.com/gateway/docs/index?doc_id=1701890973258754), [TikTok standard events](https://ads.tiktok.com/resources/help/article/standard-events-parameters?lang=en), [Google conversion contract](https://developers.google.com/tag-platform/devguides/conversions), [Sheets values/OAuth requirements](https://developers.google.com/workspace/sheets/api/guides/values). CAPI pins the documented `v25.0` edge. Public documentation was retrieved before writing production adapters; CI never uses real credentials or contacts ad platforms.

### Sheets synchronization

Order created → one row; confirmation and every shipment change → update that same row. The deterministic external mapping is unique `(connection, Order Number)`, independent of event/job retries. Processing reads the latest committed Order/Shipment projection, preventing older queued events from regressing the row. Destination edits retain the logical connection/row mapping; a future production adapter must bind external row identifiers to spreadsheet/tab revisions. The test adapter simulates acceptance followed by a lost response to prove retry deduplication.

Columns are Order Number, Created At, Store, Market, Customer, Phone, Product, Quantity, Order Total, Currency, Order Status, Confirmation State, Shipment Status, Tracking Number, UTM Source and UTM Campaign. Prices come from original Order/Item snapshots. Costs, secrets, internal IDs and full attribution payloads are omitted. Authenticated Store owners/admins can inspect test rows and recent safe event outcomes; foreign tenants cannot access configuration, health, rows or Analytics.

### Analytics and Dashboard

`/analytics` appears under OPERATIONS after Fulfillment. Today, Yesterday, Last 7 days, Last 30 days and Custom use **UTC calendar days**, inclusive start/exclusive end; a custom end date includes that full day and ranges are limited to 366 days. All filters select an **Order creation cohort** and show its current outcomes, not deliveries that happened within the range. Store/Market/Product filters and breakdowns are tenant scoped.

Orders = all created cohort orders. Confirmed = confirmation timestamp exists. Shipped = Shipment reached shipped, including later outcomes. Delivered/Refused/Returned = current Shipment status. Confirmation Rate = Confirmed / Orders; Delivery Rate = Delivered / Orders. Empty cohorts return 0%. Submitted Order Value includes original totals for all cohort orders, including cancelled/returned orders. **Delivered Revenue includes only original Order totals whose current Shipment is delivered**; submitted, confirmed, shipped, refused or returned never qualify. Values are grouped by currency, never summed across KES/GHS/etc. Product breakdown values use immutable line totals, excluding shipping fees; multi-product orders may count in multiple product groups. Funnel step percentages divide by the preceding step. No visitor funnel, predictive recommendations, profit or provider-reported revenue is inferred.

Dashboard retains its concise operational counts and delivered revenue and links to full Analytics. Tests cover opt-in/secret boundaries, event policy, snapshot values, lifecycle exports, accepted-but-interrupted retries, tenant isolation, UTC ranges and market/product analytics. The new browser flow uses the real worker and deterministic adapters, delivers Kenya KES 3,990 after an offer edit, verifies matching Meta Lead and original-value Purchase, checks one updated Sheets row, and separately delivers Ghana to verify market/currency breakdowns. All Checkpoint 1–6 scenarios remain in the full quality gate.

Stopped at Checkpoint 7. AI, WhatsApp automation, profit, settlement, inventory, payments, agency mode and a second fulfillment provider remain excluded.

Checkpoint 7 verification: all seven quality gates passed (`typecheck`, `lint`, `format:check`, `test`, `test:integration`, `build`, `test:e2e`): 33 unit tests, 97 database integration tests and 10 browser scenarios. The final tracking/Analytics browser flow also passed after the layout and input-validation updates. Fresh-database migration verified all 39 tables and the event integrity trigger. Production provider accounts were not contacted or validated.

## Checkpoint 8: product audit and UX completion

The [parity audit matrix](docs/checkpoint-8-audit.md) records every implemented screen and workflow, its baseline status and the changes made. CODShift was used only as a workflow reference; AfricaCod retains its own branding, copy, assets and visual design. Before editing, a live browser audit covered 21 populated routes at 375px, 768px and 1280px. Store detail overflowed at 375px; the other audited routes had no page overflow or client exceptions.

The persistent sidebar now includes Confirmation under OPERATIONS, with accurate active state for both confirmation and callback routes, organization context and an account menu. Mobile navigation supports Escape, focus containment, focus restoration and an inert background. Skip links and visible focus styles support keyboard use. Organization switching remains unimplemented.

Dashboard now surfaces real Recent Orders, Confirmation Queue, Callbacks Due, Fulfillment Ready and Market Performance alongside existing operational counts and delivered revenue. Work lists are bounded to five entries with queue links; market comparison uses the last 30 UTC days and states its order-creation cohort. All figures come from tenant-scoped database services. Store detail organizes Overview, Markets, Branding, Storefront and Apps without changing zero-market creation or searchable selection across the 252-entry reference catalog.

Products retain their two-column editor, independent market offers, variants and media. Lists now expose draft/published page state; the editor has a publication summary and price/status offer summaries. Categories add status filtering and product counts while keeping only two levels. Orders preserve every filter, search and pagination, with contained styled tables, queue tabs, contextual empty states and direct Callback/Cancel entry points. Detail pages show a next-action link, separate shipment/commercial statuses, section navigation and private internal cost snapshots. Callback scheduling remains explicitly UTC. Manual fulfillment remains functional; ShipCOD production readiness is never implied.

Analytics retains all Checkpoint 7 metric definitions, historical totals, current delivered-shipment truth and separate currencies. It presents market comparison first, a visual operational funnel, empty-state guidance and recoverable invalid-filter feedback. Unexpected database errors reach the error boundary rather than being misreported as invalid filters. CMS lists show navigation and update date; editing distinguishes Content, SEO, Navigation and Publication. Apps separate PARTIAL implementation readiness from actual connection health. ShipCOD remains TEST ADAPTER / production API blocked; Shipsen and other future integrations are Coming soon.

Workspace and public Store routes have loading and recovery states. Storefront navigation retains explicit markets and shows local currency context; inactive/draft data stays private. Checkout keeps server-authoritative prices, validation and Idempotency-Key retry behavior. Successful receipts receive keyboard focus and explain the confirmation/delivery next step. Landing communicates the actual COD lifecycle and integration limitations, with no fabricated reviews, sales, customer counts or urgency.

### First-party visitor foundation

Migration `0011_visitor_observations.sql` adds `visitor_events` (40 tables total), separate from commerce events and operational revenue truth. Capture records `store_view`, `product_view` and the first `checkout_started` interaction per rendered form. `checkout_submitted` remains the authoritative existing commerce event derived from a committed Order, not a client claim. Product view uses the existing validated view request rather than adding a duplicate network request; it also preserves the Checkpoint 7 internal `product_viewed` event.

Observations contain only a per-event random UUID, server-derived organization/Store/product identity, optional selected market, event type and server timestamp. No persistent visitor/session ID, cookie, IP, user agent, fingerprint, customer payload or session replay is stored. Do Not Track suppresses first-party browser capture. The same-origin endpoint rejects unexpected fields, invalid markets and unpublished/unavailable products. Retries with the same UUID cannot duplicate observations; composite foreign keys enforce tenant and Store identity. The worker prunes observations and anonymous product-view events older than 30 days on startup and daily. It never prunes Order or Shipment events.

A tenant-authorized service can aggregate observation counts for a Store and date window. **Advanced visitor UI, unique visitor counts, real-time dashboards and visitor conversion rates are deferred**: these observations can be missed or repeated across page loads and can include bots. Operational Analytics remains independent of visitor capture and external ad platforms.

### Performance and remaining gaps

Public browsing stays server-rendered; only market selection, checkout and optional tracking need client behavior. Product metadata and rendering share request-scoped data with React cache, with no persistent caching infrastructure. First-party captures are nonblocking and Store-only capture avoids fetching CMS/category data. Images retain intrinsic dimensions, lazy loading below the first product image and explicit responsive sizing. Media remains served through publication-authorized routes with `no-store`: optimization through a persistent image cache is intentionally deferred until it can preserve unpublication privacy. Large merchant uploads should be resized for deployment; a publication-safe image transformation pipeline remains a baseline gap.

No external integration was promoted to production-ready: Meta is PARTIAL pending live merchant setup/verification; TikTok and Google Ads are PARTIAL browser foundations; Sheets is PARTIAL with tested idempotent mocks and production OAuth deferred; ShipCOD is BLOCKED for production API access. Password reset/2FA management, subscriptions, organization switching, advanced page builder and advanced visitor analytics remain outside this checkpoint. No AI, profit engine, settlements, inventory, payment checkout, WhatsApp automation, agency mode or second courier was added.

Tracking enablement updates now use the database clock, matching Order event timestamps; this fixes an immediate-after-configuration cutoff race without replaying historical events or weakening retry tests.

### Checkpoint 8 verification

All seven quality gates passed: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (**33 tests**), `pnpm test:integration` (**98 tests**), `pnpm build` and `pnpm test:e2e` (**11 tests**, Chrome). A fresh PostgreSQL migration produced all **40 tables**. Browser regression includes earlier checkpoints and the new merchant/customer UX scenario at **375px, 768px and 1280px**, with no page overflow or client exceptions in that scenario. Visual review covered Order detail and the mobile receipt. Accessibility checks cover labels, focus, navigation, mobile menu behavior and receipt feedback; formal WCAG review remains a deployment task.

## Checkpoint 9: production hardening and integration activation boundary

The repository is a production beta candidate, conditional on the external release checklist in [production readiness](docs/production-readiness.md). The [severity audit](docs/checkpoint-9-audit.md) records blockers and deferred findings; the [42-table constraint audit](docs/database-audit.md) covers the original 40 tables plus operational OAuth states and shared abuse buckets. No new major business domain is added.

`APP_ENV` explicitly distinguishes development, isolated test, staging and production. The web build/start CLI validates before launching Next.js (instrumentation can initialize lazily); the worker validates before its processing loop. Production requires: HTTPS, PostgreSQL TLS, independently generated credential keys, trusted-proxy rate-limit identity and private S3 storage are mandatory; deterministic provider/tracking adapters are forbidden. `.env.example` documents configuration. Web and worker must receive the same long-lived encryption keys. Production does not load local `.env` files. Staging uses separate resources and may explicitly enable mock adapters; a production build never implies live provider authorization.

Checkout/auth/anonymous observations/media/actions now share atomic PostgreSQL abuse budgets across instances. Request bodies are bounded, request IDs and safe JSON diagnostics omit customer payloads/provider responses/secrets, and alive/database-ready endpoints are separate. Merchant-facing failed tracking jobs show safe reason/time/retry eligibility, preserving event IDs and current connection revision. Orders remain durable even when external exports fail.

Media uses a real S3-compatible SDK adapter with private generated paths, conditional writes and tenant/publication-authorized delivery. Uploaded PNG/JPEG/WebP is decoded, size/pixel limited, normalized to at most 1600 pixels and stripped of metadata. Private responsive WebP derivatives serve product images/cards/logos; no-store public responses preserve unpublish revocation. The S3 transport, optimization and deletion are tested against a local HTTP S3 emulator; live R2 credentials, bucket ACL and deployment behavior remain external checks. Historical product/market/offer deletion protection is regression tested.

Google Sheets now supports Connect Google, state/PKCE callback, encrypted offline tokens, refresh and disconnect. Configure Google Cloud web OAuth/Sheets API credentials, exact callback URL and approved beta users; enter spreadsheet ID and numeric tab `gid` in Apps. A dedicated empty tab provides an Order Number ledger; RAW fixed-row updates preserve idempotence after lost responses and follow tab renames. Revoked authorization, deleted destinations, missing permission, quotas and temporary failures surface safely. Do not share tab write ownership with another exporter. CI uses mocked Google HTTP responses; no live connection is claimed.

Meta retains matching browser/CAPI Lead event IDs, immutable order values and optional delivered-only Purchase. Current official Meta documentation was reviewed successfully, including v25.0 transport, deduplication, required website context, hashing and Purchase value/currency. Live account validation remains required. TikTok/Google Ads stay honest browser foundations with server conversions deferred. ShipCOD production remains BLOCKED pending official documentation/access; manual fulfillment remains fully available.

Required-mode Store consent separates essential auth/checkout from optional analytics and marketing. Modules default OFF until a signed preference is saved; browser DNT is respected. URL queries and disallowed marketing attribution are removed. Worker cleanup enforces 30-day anonymous observation retention; commercial retention/anonymization is an operator policy, not destructive automatic deletion. Deployment, monitoring, backup restore, encryption-key rotation and rollback runbooks are included. Self-service recovery/verification/MFA and strict nonce CSP remain documented deferred work for a closed beta.

Formal accessibility regression adds axe WCAG 2 A/AA and 2.1 AA checks to merchant screens, authentication, public checkout and Order detail, alongside existing keyboard/mobile/focus/error tests. Low-contrast copy is corrected; invalid legacy PNG fixtures are replaced with valid decodable images rather than relaxing upload validation. No WCAG certification is claimed.

Additional verification commands:

```sh
pnpm exec tsx scripts/verify-migrations.ts # local disposable fresh + CP8 upgrade databases
pnpm exec tsx scripts/verify-production.ts # strict production build; ephemeral keys, zero mocks
pnpm exec tsx scripts/verify-production-startup.ts # actual startup rejects mock flags before listening
PLAYWRIGHT_CHROME_CHANNEL=chrome pnpm exec tsx scripts/staging-smoke.ts # disposable fresh DB, manual lifecycle, zero mocks
```

For optional S3 network verification, start an isolated local S3 emulator at port 9090 with a bucket named `africacod-test-media`, then run `pnpm exec tsx scripts/verify-s3.ts`. Its synthetic credentials are test-only and are never production defaults. Set the documented S3 variables on `staging-smoke.ts` to exercise media over that SDK transport. A real private bucket check is still a release condition.

Run deployed processes with `pnpm --filter @africacod/web start` and `pnpm --filter @africacod/worker start`. Their TypeScript launcher is a runtime dependency. Authentication diagnostics and session/handler failures use safe fixed messages; vendor error arguments are never forwarded to logs.

### Checkpoint 9 verification

All seven gates pass: typecheck, lint, formatting, **54 unit tests**, **101 integration tests**, strict production build with both test adapters disabled, and **12 Chrome E2E tests**. Actual production startup rejects mock flags and missing `APP_ENV` before opening a listener, without inheriting a local development identity. Fresh and CP8-upgrade migration checks produce **42 tables**, seed **252 reference countries** idempotently, preserve existing data and create no StoreMarkets. S3 SDK network roundtrip, responsive derivation and deletion pass against an isolated local emulator. Browser accessibility checks report no axe violations in the tested screens, with keyboard and responsive regressions retained. Live provider receipts, real bucket policies and deployed infrastructure remain external release conditions.

The disposable fresh-database staging smoke also passes **2 tests**: the complete manual COD lifecycle through delivery/return and analytics, and a Chromium-intercepted Google authorization redirect verifying PKCE, state cookie and no browser client secret. Both integration test adapters are disabled; consent is required, encryption keys are independently generated for the run, and media uses the real S3 SDK against the isolated emulator. No live Google account is contacted by the passing test.
