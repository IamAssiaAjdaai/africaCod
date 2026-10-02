# AfricaCod

An Africa-first cash-on-delivery commerce workspace. Checkpoint 1 provides **Account → Organization → Store → Add Markets**. Checkpoint 2 adds **Categories → Products → Product Media → Basic Variants → Market Offers**.

A store starts with **zero markets**. Platform country definitions are reference data for a comprehensive country/territory catalog; only an explicit **Add Market** action creates a store market. No storefront publishing, checkout, Orders, Pages, Apps, fulfillment, analytics, AI, or external integrations are implemented.

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

The Playwright suite additionally covers the full Checkpoint 2 workflow with image upload, variant, Beauty/Hair assignment, Kenya/Ghana pricing, product-list persistence, mobile editor layout and foreign product/category/media denial. The original suite covers reload persistence, duplicate-picker prevention, searchable Kenya/Ghana/Rwanda/Angola selection, activation/deactivation, sign-out/login, authentication redirects, tenant URL isolation, and mobile layout. It creates uniquely named accounts/stores in the local app database and leaves them for inspection; use a disposable database in CI. It starts the production server if needed, so run `pnpm build` before `pnpm test:e2e`. A running local dev server can also be reused. On macOS versions unsupported by Playwright’s bundled Chromium, use an installed Chrome:

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
- Stable market IDs link product offers and provide a future attachment point for address configuration, shipping, fulfillment and COD rules. Those other future domains have no tables yet.
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

Deferred: variant-specific market pricing, inventory and option combinations; rich text editing; category deletion; external storage adapters and media processing; storefront publishing, checkout, Orders, Pages, Apps, fulfillment, analytics, AI and external integrations. Variants are descriptive product versions only; every market offer applies to the whole Product.
