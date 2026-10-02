# AfricaCod

An Africa-first cash-on-delivery commerce workspace. This checkpoint implements **Account → Organization → Store → Add Markets** only.

A store starts with **zero markets**. Platform country definitions describe supported countries; only an explicit **Add Market** action creates a store market. No Products, Orders, Apps, fulfillment, analytics, AI, or integrations are implemented.

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
5. Click **Add Market**, select **Kenya**, and click **Add selected market**.
6. Verify the row shows **Kenya / KES / en-KE / Active**. Reload; it persists.
7. Add **Ghana** independently. Kenya is no longer offered in the picker.
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

`pnpm test` runs fast authentication-boundary, validation, and country-catalog tests. `pnpm test:integration` applies the real migration and tests commerce operations against PostgreSQL. It requires `TEST_DATABASE_URL` to point to a database whose name ends in `_test`, and cleans up only its own tenant fixtures. Compose creates `africacod_test` on its first initialization. If you use an existing volume without that database, create it with `docker compose exec postgres createdb -U africacod africacod_test`.

The Playwright suite covers the complete happy path, reload persistence, duplicate-picker prevention, Ghana, activation/deactivation, sign-out/login, authentication redirects, tenant URL isolation, and mobile layout. It creates uniquely named accounts/stores in the local app database and leaves them for inspection; use a disposable database in CI. It starts the production server if needed, so run `pnpm build` before `pnpm test:e2e`. A running local dev server can also be reused. On macOS versions unsupported by Playwright’s bundled Chromium, use an installed Chrome:

```sh
PLAYWRIGHT_CHROME_CHANNEL=chrome pnpm test:e2e
```

Generate a new migration after schema edits using `pnpm db:generate`. Apply migrations with `pnpm db:migrate`; the seed is idempotent and only inserts missing country definitions. It does not reset country settings or create store markets.

`pnpm build` runs the web production build and checks the reserved worker. Run `pnpm --filter @africacod/web start` to serve the production build. The worker is an idle, gracefully stoppable process with no background jobs at this checkpoint.

## Modules

| Module                | Responsibility                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `apps/web`            | Next.js 16 App Router, landing, auth, onboarding, authenticated screens and server actions |
| `apps/worker`         | Reserved worker entry point; no queues or business jobs                                    |
| `packages/db`         | Drizzle PostgreSQL schema, SQL migration, seed and Docker initialization                   |
| `packages/domain`     | Organization/store/market operations with persisted-membership authorization               |
| `packages/auth`       | Better Auth email/password, session and client configuration                               |
| `packages/markets`    | Extensible initial country catalog                                                         |
| `packages/ui`         | Shared original branding, badges and page headings                                         |
| `packages/validation` | Zod input schemas; browser-supplied tenant/currency data are ignored                       |
| `packages/shared`     | Root environment loading and validation, default locale boundary                           |

## Schema and security

Nine tables: Better Auth `users`, `sessions`, `accounts`, `verifications`; business `organizations`, `organization_memberships`, `country_definitions`, `stores`, `store_markets`.

- Membership roles: **Owner**, **Admin**. Organization creation and owner membership run in one transaction.
- This checkpoint deliberately supports one organization membership per account, enforced by a unique constraint. Each organization can have many stores and memberships. Invitations, organization switching, and role-management UI are outside this checkpoint.
- All tenant-owned stores and markets carry `organization_id`. Server operations derive the organization from the authenticated user’s persisted membership. Browser IDs are resource selectors, never authorization evidence.
- Every store lookup and market read/update includes organization scope. Cross-tenant reads return a generic not-found result. Server actions authenticate separately from the route layout.
- A composite market foreign key `(store_id, organization_id)` references the same pair on stores, preventing database-level tenant mismatches.
- Public store identifiers are **globally unique** lowercase slugs (3–63 characters), with reserved names, validated at the boundary and enforced by PostgreSQL. These are identifiers; no public storefront is built yet.
- `(store_id, country_code)` is unique, including inactive records; deactivation is a status update, never deletion. Currency and locale are snapshots from the selected active country definition.
- Stable market IDs provide a future attachment point for market-specific offers, address configuration, shipping, fulfillment and COD rules. No tables for those future domains exist.
- Better Auth owns password hashing and session cookies. No custom auth cryptography. Email verification/delivery, password reset, social login and two-factor authentication are outside this checkpoint. Authentication uses Better Auth’s in-process rate limiter; a shared limiter is not introduced for a single-process local checkpoint.
- English UI strings live in the web presentation layer; ISO codes and BCP 47 locales are data. No country-specific branching in the business service. A full translation catalog is deferred.

Initial country catalog: Kenya (KE/KES), Ghana (GH/GHS), Guinea (GN/GNF), Côte d’Ivoire (CI/XOF), Senegal (SN/XOF), Cameroon (CM/XAF), Tanzania (TZ/TZS), Uganda (UG/UGX), Nigeria (NG/NGN), Morocco (MA/MAD).

Reference implementations: [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Drizzle migrations](https://orm.drizzle.team/docs/migrations).

## Routes

Public: `/`, `/sign-up`, `/sign-in`, `/api/auth/[...all]`.
Authenticated: `/onboarding`, `/dashboard`, `/stores`, `/stores/new`, `/stores/[storeId]`, `/settings`.
Unauthenticated access redirects to sign-in. Accounts without an organization are redirected to onboarding. Mutation requests use Next.js server actions with input validation and membership authorization.

## CI

`.github/workflows/ci.yml` installs the frozen pnpm lockfile, starts disposable PostgreSQL, applies migrations/seeds, checks types/lint/format/unit/integration/build, and runs Chromium E2E. No external services beyond PostgreSQL are required. Secrets are injected through environment variables; `.env`, dependencies and generated browser reports are ignored by Git.
