# Checkpoint 9 production beta readiness

Status: **production beta candidate; deployment is conditional on external infrastructure and operational verification.** No live provider receipt is claimed by CI. ShipCOD remains BLOCKED. This is not a WCAG certification or a legal compliance claim.

## Infrastructure

- [x] READY — recommend two Node 22 processes/containers: Next.js web and persistent worker, managed PostgreSQL with TLS, private S3-compatible/R2 bucket. No additional business service required.
- [ ] REQUIRES EXTERNAL CREDENTIALS — provision separate production and staging databases, buckets, domains, secrets and OAuth apps. HTTPS reverse proxy must overwrite the configured client IP header; prevent access to the origin outside that proxy. Do not trust arbitrary forwarded headers.
- [ ] Configure proxy request limits: 12 MB uploads, 16 KB auth/checkout, smaller observation/consent bodies; timeouts and origin protection. The application also bounds streamed public payloads and decoded images.

## Database

- [x] READY — fresh migrations and CP8 upgrade tested; twice-run reference-only seed preserves data and creates no StoreMarkets. Store starts with zero markets; composite membership and market uniqueness remain unchanged.
- [x] READY — all 40 existing tables plus two operational tables reviewed in [database audit](database-audit.md). Commercial references restrict deletion; archive/deactivate remains the ordinary workflow. Auth/session and expendable tracking children are the intentional cascade cases.
- [x] READY — indexes match order tenant/store/market/status/date/assigned-agent filters, duplicate phone searches, callback due queries, order-item joins, job connections and retention. Existing fulfillment/shipment/provider identity indexes are retained. Measure real production query plans before adding further indexes.
- [ ] Run migration once as a release job, then reference seed; use a restricted runtime DB role and separate migration role. Enable slow-query monitoring with parameter redaction.

## Security

- [x] READY — fail-fast production validation rejects mock flags, local media, missing security keys, HTTP endpoints, absent database TLS and fixture encryption keys. Configuration errors disclose variable names only.
- [x] READY — atomic PostgreSQL abuse buckets protect auth, checkout, observations, media and actions across instances. HMAC keys avoid stored raw IPs. Checkout idempotency remains an independent business key; 429 never consumes that key.
- [x] READY — hostile checkout regression keeps price/currency/cost/tenant/offer authority on the server; unknown browser economics cannot replace snapshots.
- [x] READY — CSP, frame denial, nosniff, referrer policy, permissions restrictions and production HSTS. CSP permits framework inline scripts/styles and fixed optional tracking hosts; strict nonce CSP is deferred (MEDIUM). Review external tracking in staging before enabling it.
- [x] READY — AES-256-GCM authenticated version-1 envelopes bind credentials to organization, Store, connection and provider. Browser projections expose configured state only.
- [ ] Key rotation runbook: pause/drain worker and credential writes; backup; enumerate encrypted provider/tracking/OAuth values; decrypt using old key with their original AAD, re-encrypt with new key in one audited migration; deploy identical new secrets to web and worker, resume and verify. Retain old key in restricted recovery escrow until backup retention expires. Do not merely replace the environment key. Future dual-key envelopes are deferred.

## Privacy

- [x] READY — public checkout returns a receipt, never customer address/phone or internal tenant IDs. Merchant PII access is tenant-scoped. Logs allowlist identifiers and fixed error codes, excluding bodies, tokens and provider response text.
- [x] READY — signed per-Store consent controls analytics and marketing separately; essential auth/checkout works without either. `required` defaults optional modules OFF; `merchant-managed` requires an operator-reviewed external consent mechanism. Attribution URL queries are removed; marketing identifiers/user agent are withheld without marketing consent. Preference changes reload the page to unload previously initialized third-party SDKs.
- [x] READY — worker prunes anonymous visitor/product-view observations after 30 days, expired OAuth states (ten-minute validity, daily physical cleanup) and expired abuse buckets. Existing retention integration regression verifies visitor cleanup.
- [ ] Operator policy required: retain commercial Order/customer/address snapshots for the documented local operational/accounting period, then controlled anonymization/export/deletion with legal-hold checks. No automatic commercial deletion is introduced. Asynchronous server events use the consent snapshot recorded at checkout; browser preference withdrawal cannot identify an already-created Order without a customer identity link. Operators must disable affected integrations and handle an Order/customer withdrawal request before further server export; granular Order consent-revocation tooling is MEDIUM deferred work, not a legal compliance claim. Limit staff access; encrypt managed database/backups; do not enable SQL payload logging. OAuth disconnect removes local tokens; revocation failures require account-side access removal.

## Auth

- [x] READY — secure HTTPS cookies, session-backed tenant authorization and role checks, trusted origin validation, distributed request limits and bounded auth bodies.
- [ ] Before closed beta, restrict `/sign-up` and `/api/auth/sign-up/email` at the trusted edge to approved merchants. Public storefront/checkout stays available. Record an operator-assisted account recovery process; deployment must not silently become unrestricted merchant registration.
- [ ] MEDIUM — email verification, self-service password recovery and MFA are deferred. Closed beta must use invited/tested accounts with an operator-assisted recovery process. No public unrestricted launch recommended.

## Media

- [x] READY — real S3 SDK transport, private generated UUID paths, conditional writes, decoded PNG/JPEG/WebP validation, ten-MB input limit, forty-million-pixel decode ceiling and metadata stripping. Local filesystem is development only.
- [x] READY — max 1600-pixel normalized originals and private WebP widths 320/640/960/1600; storefront chooses responsive widths, cards/logos use 320. Every public delivery rechecks publication and ownership; no persistent public object URLs bypass unpublish. Responses use no-store to preserve publication revocation, with private cached derivatives reducing repeated CPU.
- [x] READY — deletion removes originals and derivatives, reports object-service failure; original cleanup errors are safe logs. CMS arbitrary embedded images are not a supported media workflow.
- [ ] REQUIRES EXTERNAL CREDENTIALS — create private bucket, narrowly scoped read/write/delete credentials and lifecycle/backup policy; configure endpoint/region. No public bucket ACL, website endpoint or browser object credentials.

## Worker

- [x] READY — durable PostgreSQL outbox; transaction row locks/advisory locks serialize concurrent workers. Crash rollback leaves a claim recoverable; remote idempotency protects accepted-but-lost responses. Terminal failures stop, temporary failures back off with a maximum attempt count.
- [x] READY — safe connection health includes failure time/reason and retry availability. Tracking retry keeps event identity and requires enabled current-revision connection; provider failure/retry workflow is preserved. Never blindly replay old connection revisions.
- [ ] Monitor one-minute worker health logs, job backlog/age and exhausted attempts. Alert if heartbeat absent for three minutes; restart on process failure. Worker requires a persistent process, not a request-only serverless handler.

## Integrations

- [x] READY — Google Sheets OAuth authorization-code flow with state, user/Store binding and PKCE; single-use expiring state, encrypted offline refresh tokens, refresh, disconnect, stable numeric sheet selection and safe error health. Network/OAuth failure does not undo Order lifecycle.
- [ ] REQUIRES EXTERNAL CREDENTIALS — Google Cloud: enable Sheets API; configure web OAuth client and consent screen, approved beta test users, privacy/support URLs; register exact `BETTER_AUTH_URL/api/integrations/google/callback`. Set client ID/secret in both processes. Connect Google in Apps, enter spreadsheet ID from its URL and numeric tab `gid`, save and enable. Dedicated empty tab only; do not share write ownership with another exporter or edit column A/order numbers. OAuth refresh access is scoped to Sheets; external-app verification/testing token expiry must be reviewed before expanding beta.
- [x] READY — Sheets uses RAW fixed-row updates, Order Number ledger, connection-serialized writes and numeric-tab metadata resolution on each write. Deleted sheet, renamed tab, expired/revoked token, missing permission, quota and temporary failures are classified and mocked in CI. Idempotence assumes a dedicated tab without competing writers; it is not a cross-vendor transaction guarantee.
- [ ] REQUIRES EXTERNAL CREDENTIALS — Google live checklist: authorize; export Order; change status and verify same row; rename tab; expire access token; revoke authorization; remove permission; delete tab; restore/reconnect and retry; confirm Orders continue through all failures. Verify account consent, quotas and OAuth publishing status.
- [ ] Meta: production adapter retained, **live activation unverified**. Current official documentation was retrieved successfully after initial rate limiting. The guide still documents v25.0; event-name/ID deduplication, SHA-256 phone normalization, unhashed fbp/fbc/user agent, website URL/user-agent requirements and Purchase currency/value were reviewed against the adapter. Live account receipt validation remains required before activation. Submitted = Lead; confirmed is never Purchase; optional Purchase requires delivered Shipment, uses historical currency/value and normalized SHA-256 customer data. Browser/server Lead share event ID; retries preserve IDs.
- [ ] Meta live checklist: own Pixel/dataset/token, Test Events receipt, matching browser/server IDs and deduplication, consent withheld means no events, Lead contains no revenue/Purchase claim; delivered Purchase has historical amount/currency, zero Purchase at submission/confirmation, one optional delivered Purchase, repeat delivered/retry without duplicate Purchase, rejected/expired token safe health. Do not send synthetic customer PII to a real merchant dataset.
- [x] TikTok/Google Ads are PARTIAL browser foundations; merchant IDs/configuration and receipt validation required; server conversion APIs remain deferred. TikTok form submission and Google Ads lead configuration must not imply delivered COD revenue.
- [ ] BLOCKED — ShipCOD production API documentation/access unavailable. Production cannot select the deterministic adapter. Manual fulfillment/shipment remains available. No other courier added.

## Observability

- [x] READY — request IDs, allowlisted JSON logs, safe error boundaries and vendor-neutral `setErrorMonitor` hook. Public `/api/health/live` distinguishes process alive; `/api/health/ready` checks database and returns generic 503 without infrastructure details.
- [ ] Wire restricted log storage and monitoring to the hook, scrub metadata before export and set retention (recommend 14 days routine logs). Alert on readiness failures, 5xx, checkout failure rates, abuse-store failure and worker backlog. Do not record HTTP bodies/cookies/authorization or URL query strings in proxy logs.

## Backups

- [ ] REQUIRES EXTERNAL CREDENTIALS — managed PostgreSQL daily encrypted snapshots plus continuous WAL/PITR; recommend 30-day backups and at least seven-day PITR. Media bucket versioning or separate backup where supported; protect encryption keys separately.
- [ ] Before beta, restore a backup into an isolated staging database, migrate/boot, verify record counts and historical Order/Shipment snapshots, private media retrieval and tenant isolation; do not run outgoing integrations against restored production credentials. Measure recovery time and agree RPO/RTO; repeat restore drill monthly and after major schema changes. Application code does not replace managed backups.

## Testing

- [x] READY — Checkpoint 9/environment-boundary baseline: all seven quality gates executed successfully: 65 unit, 101 integration and 12 Chrome E2E tests; strict zero-mock production build; fresh/CP8-upgrade migrations and repeat reference seed; S3 SDK roundtrip/derivation/deletion; actual startup rejection of mocks and missing deployment identity. The environment-boundary build has no Edge warnings for process.cwd, node:fs or node:path; browser bundling tests prevent Node imports from returning to shared/proxy/instrumentation. Two disposable fresh-database staging smoke tests pass with required consent, S3 transport and both mock adapters disabled, including manual COD lifecycle and intercepted OAuth redirect.
- [x] Formal accessibility review uses axe WCAG 2 A/AA and 2.1 AA checks across merchant screens, storefront checkout and Order detail, alongside keyboard focus/Escape/mobile menu/labels/errors and 375/768/1280-pixel overflow regression. This is automated and targeted keyboard verification, not formal WCAG certification.
- [ ] External live service receipts, deployed TLS/proxy configuration, backup restore and platform alerts cannot be certified by local CI. See actual execution results in README and audit.

## Deployment

- [x] READY — shared parsing/logging exports are Edge-safe and side-effect free. Explicit `@africacod/shared/node` loading belongs only to Node bootstraps; production process values remain authoritative. Proxy only forwards request IDs; PostgreSQL rate enforcement remains in Node handlers/actions with unchanged budgets.
- [x] READY — web dev/build/start preflight validates before launching Next.js; instrumentation alone is lazy and insufficient for fail-fast startup. Worker validates before processing. Use `pnpm --filter @africacod/web start` and `pnpm --filter @africacod/worker start`; keep runtime dependencies installed. Authentication uses a safe logger and generic session/handler failures.
- [x] READY — environment definitions: development local; test isolated `_test` database; staging separate non-production resources, optional explicit mock flags; production mandatory external secrets and mock flags zero. `NODE_ENV=production` alone is insufficient: set `APP_ENV` explicitly. Production and `NODE_ENV=production` skip local dotenv loading; missing `APP_ENV` is rejected instead of inheriting a development identity.
- [x] Every application setting is documented in `.env.example`: database/auth URL and secret; dedicated credential keys; adapter flags; HMAC rate-limit key/trusted client header; media provider/endpoint/region/bucket/credentials; Google OAuth pair; consent mode. `NODE_ENV`, `PORT`, `NEXT_PHASE` are framework-managed; `TEST_DATABASE_URL` and `PLAYWRIGHT_CHROME_CHANNEL` are test-only.
- [ ] Release: provision secrets → build with production configuration and zero mocks → backup → migrate/seed once → start web/worker with the same keys → verify live/ready, worker heartbeat and private media → run isolated staging smoke → manually verify TLS/proxy/consent/provider setup → invite a small closed beta.
- [x] Run `pnpm exec tsx scripts/verify-migrations.ts` only against local disposable DB infrastructure. Run `pnpm exec playwright test --config playwright.smoke.config.ts` for manual lifecycle with mocks disabled. Staging may configure a real private S3 bucket; never use production customer data.

## Rollback

- [x] READY — CP9 is additive (new operational tables, consent field, indexes and stronger FK). Keep prior application artifact available. Roll back application only after compatibility check; do not drop new columns/history or run destructive down migrations. OAuth-created production Sheets connections must be disabled before reverting to a version without OAuth support.
- [ ] Stop integrations/worker before incident rollback; keep encrypted keys compatible, capture safe logs, restore only through the managed restore procedure when required, check idempotency ledger/outbox before resuming. A database restore can replay external effects; compare remote receipts before retry.

## Official references reviewed

- [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).
- [Sheets metadata](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get), [fixed-range updates](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update), [limits](https://developers.google.com/workspace/sheets/api/limits).
- [TikTok standard events](https://ads.tiktok.com/resources/help/article/standard-events-parameters?lang=en), [Google Ads conversions](https://developers.google.com/tag-platform/devguides/conversions).
- [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/), [Sharp decoding limits](https://sharp.pixelplumbing.com/api-constructor/).
- [Meta deduplication](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events), [customer data](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters), [server events](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event), [custom data](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/custom-data), [API transport/version](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api). Documentation review succeeded; live account receipt validation remains external.

## Checkpoint 9.1 publication and customization boundary

Store settings are scoped per Store, with explicit Save Draft / authenticated read-only Preview / atomic Publish. Public routes and checkout use only Published settings; stale revisions and invalid resources fail without replacing the live snapshot. Preview disables checkout and observations and has noindex metadata. CMS navigation is checked both when publishing settings and when rendering, so later page unpublication cannot expose a Draft page.

Store assets remain in the existing private storage architecture, validated and normalized before upload. Responsive delivery rechecks the published reference or authenticated Store ownership on every request. Legacy logos are adopted as Store-owned assets; old drafts/publications never cause private objects to become directly accessible. Unreferenced assets remain private; automated orphan-media cleanup and full publication history are deferred.

Custom order-field values are bounded, server-validated against Published configuration and persisted as historical ID/label/type/value snapshots in the same checkout transaction. Core market phone/address, offer, price, quantity, variant and idempotency validation remains authoritative. No merchant arbitrary code or external font execution is supported. Fonts are self-hosted open-source packages; browser scripts remain limited to existing explicit Apps integrations.

Dashboard definitions and limits are documented in README. Period delivery activity and creation-cohort performance are distinct. Revenue uses historical commercial snapshots and remains separated by currency; refused/returned shipments are excluded. Visitors are consented observations, not unique users, and older-than-30-day visitor coverage is incomplete by design. Unknown attribution stays Unknown. Queries aggregate in PostgreSQL, with a partial delivered-date index and existing tenant/date indexes.

Staging remains a separate, explicitly authorized deployment step. Existing infrastructure, private bucket, trusted proxy, credentials, backups and operational acceptance requirements still apply; ShipCOD live activation remains blocked pending official account/API documentation.

Private Store previews use a separate authenticated route group and the same Store shell as public rendering, without nesting storefront main landmarks inside the merchant workspace. Dialogs use native modal focus trapping and Escape behavior; settings tabs support arrow/Home/End navigation and reorder buttons are keyboard accessible. Color inputs include textual HEX values, validation errors are announced, and custom-field values are never rendered as HTML.

Checkout request bodies remain streamed and bounded at 128 KiB, accommodating eight bounded custom fields, optional notes and UTF-8 attribution. Server schemas enforce the individual field/count limits before persistence; rate limiting and origin/idempotency checks remain in place.

Checkout hash compatibility is preserved for pre-9.1 Orders: absent new values do not change the old request digest. Custom-field keys are sorted before hashing; changing submitted values still conflicts, while equivalent retries continue to return the historical receipt after settings edits.

### Checkpoint 9.1 verification record — 2026-10-03

- [x] Final sequential quality gate: typecheck, zero-warning lint, format check, 94 unit tests, 119 integration tests, strict zero-mock production build and 13 Chrome E2E tests all passed.
- [x] Fresh database and Checkpoint 9 upgrade: 43 tables, 252 reference countries, zero automatic StoreMarkets, legacy branding/private logo preservation.
- [x] Production startup rejects mock adapters and missing deployment identity. Build output has no Edge warnings for `process.cwd`, `node:fs` or `node:path`, and no other warning text.
- [x] Responsive checks at 375/768/1280px for Dashboard, Store Settings, private Preview, public Store, Product Page and checkout; no document horizontal overflow, with automated accessibility checks passing. Existing workflows and market-specific prices remain green.
- [x] Historical custom-field snapshots, old checkout-key compatibility, canonical custom-field retry hashes, failed-publication preservation and tenant/private-media boundaries are covered by regression tests.
- [ ] Staging acceptance must monitor the pre-existing Next.js closed-stream navigation diagnostics. Browser tests pass, including client-error assertions; diagnostics remain visible and were not suppressed.

Recommend proceeding to a separately authorized staging deployment once the existing infrastructure/credential/backup checklist is satisfied. Keep ShipCOD disabled pending official API material and live acceptance. No deployment was performed by this checkpoint.
