# Workspace UI refinement

This change refines existing merchant screens. Database schemas, server queries,
authentication handlers, authorization, API contracts, checkout, tracking,
environment files and deployment configuration are unchanged.

## Audit and design decisions

The initial audit found competing workspace CSS rules, serif headings on operational
screens, several green palettes, oversized promotional elements, inconsistent
control and table sizing, and binary status styling. An inactive Store card also
incorrectly used the active badge presentation.

- Semantic surface, text, border, brand, status and focus variables live in
  `globals.css`. Existing storefront theme variables remain intact.
- `workspace.css` scopes every rule to `.app-shell` or `.auth-page`. Loading it on
  a public route cannot apply workspace styles to a merchant StoreShell.
- Geist, 26px page titles, 16px section titles, 14px body and 12–13px metadata,
  labels and controls establish a compact hierarchy.
- Spacing follows 4/8/12/16/20/24/32/40/48px. Controls use 6px radii; panels use
  8px radii, subtle borders and no decorative shadows.
- Brand green is reserved for primary actions and active navigation. Success,
  warning, danger, information and neutral status colors always accompany text.
- `PageHeading` supports primary/secondary actions. Existing Badge gains semantic
  tones; StatusBadge maps labels for presentation only. TableScroll provides a
  named keyboard-focusable horizontal scroll region. EmptyState is reused by
  Products and Pages.
- Obsolete shell rules were removed incrementally from globals.css; storefront
  styles were retained rather than replaced.

## Screens and behavior

The shell groups existing routes under Operations, Catalog, Storefront, Insights
and Platform. Workspace/account identity is compact. Promotional sidebar content
and redundant topbar actions are removed. Existing drawer and sign-out behavior
are preserved.

Dashboard keeps every existing real metric and aggregation. Period KPIs, chart,
funnel, all-time operational queues, delivered revenue and actionable orders are
visually distinguished. A conditional Review orders link uses the existing count.

Orders, Confirmation, Callbacks and Fulfillment share workflow navigation, table
spacing, semantic status badges and pagination. Existing filters and operation
handlers remain unchanged. No-answer is a secondary action; cancellation is danger.

Products, Categories, Stores and Pages use the shared catalog/table language.
Store cards show the correct inactive state and public path. Store detail puts
page context before setup guidance. Store Settings keeps its four existing tabs,
Draft/Preview/Publish behavior and field configuration, with consistent grouping,
selected tabs, color controls and destructive-action styling.

Analytics uses consistent range controls, legends and table typography. Apps retains
all partial/unverified/blocked readiness wording and shows connected status only
when the existing connection computation reports it. Account settings and auth
forms use the same quiet controls and typography. Auth handlers are untouched;
onboarding continues through the existing first-Store workflow.

Public landing and merchant storefront styling remain separately expressive.
Existing market pricing, media, draft preview, checkout and attribution
regressions remain in the browser suite. New computed-style checks explicitly
exercise dark and system themes and ensure draft brand changes do not alter the
published Store.

## Responsive and accessibility verification

The browser regression covers 375, 768, 1024, 1280 and 1440px across the existing
workspace routes, Store Settings and authenticated Kenya preview. It checks document
horizontal overflow, readable headings, correct active navigation and keyboard
horizontal table scrolling. Drawer assertions cover focus entry, forward/backward
focus wrapping, Escape, focus restoration, background inertness and body scroll lock.

Small mobile actions and tabs have at least 44px heights; form text is 16px on mobile
to avoid input zoom. Focus rings remain visible and reduced motion disables scoped
animations/transitions. Existing axe WCAG 2 A/AA and 2.1 AA assertions include
workspace, preview, public checkout and Order Detail.

The semantic text/status/button color pairs were independently measured at
4.81:1 or higher (normal-text minimum 4.5:1). The expanded audit caught legacy
Store metadata colors, squeezed mobile Dashboard range controls, overlapping search
icons and a narrow Order Detail grid; these were corrected before final verification.

Review screenshots use synthetic local test data:

- [Dashboard, desktop](ui/workspace-dashboard-desktop.png)
- [Products, desktop](ui/workspace-products-desktop.png)
- [Store Settings, mobile](ui/workspace-settings-mobile.png)
- [Order Detail, tablet](ui/workspace-order-detail-tablet.png)

Additional screenshots are captured by the UX browser regression in ignored
`test-results/workspace-*.png` for manual review.

## Scope boundaries and remaining debt

- Next.js occasionally logs `The destination stream closed early` during rapid
  test navigation. This pre-existing diagnostic remains unsuppressed; backend
  rendering changes are outside this UI PR. Fresh local migrations also emit
  existing PostgreSQL identifier-truncation NOTICE messages.
- The existing Store list performs a per-Store market lookup. This was observed
  during the audit and intentionally left for a separate server-performance change.
- ShipCOD production access and unverified third-party integrations remain subject
  to the existing documented readiness limitations. This UI work does not activate
  services or imply verified live delivery.
- Existing public/landing CSS and some older shared page rules remain in globals.css.
  Further extraction can be incremental; wholesale stylesheet replacement is avoided.
- Wide operational tables intentionally scroll within named regions on mobile.
  A dedicated mobile card layout is a possible later refinement, not a new feature
  in this change.

## Validation

| Check                   | Result                                    |
| ----------------------- | ----------------------------------------- |
| `pnpm typecheck`        | Passed, 9 tasks                           |
| `pnpm lint`             | Passed, zero warnings/errors              |
| `pnpm format:check`     | Passed                                    |
| `pnpm test`             | 95 passed in 20 files                     |
| `pnpm test:integration` | 124 passed in 9 files                     |
| `pnpm build`            | Passed, 2 tasks; no Edge Runtime warnings |
| `pnpm test:e2e`         | 14 passed in 9.0 minutes on `56fd023`     |

The final button-variant change on `3376a4e` receives an additional affected-flow
browser run covering operations, provider handoff, Store Settings and responsive UX.
All 4 scenarios passed in 6.4 minutes. Typecheck, lint and the production build
also passed after that change. The build uses the existing strict production
verification helper, with test adapters disabled; environment files were not edited.
No required checks are skipped. Final documentation changes receive another format
check. GitHub CI must be assessed against the final PR commit, separately from these
local results.

Intermediate browser attempts encountered transient request availability failures.
A fresh complete run passed without relaxing assertions or timeouts. The existing
stream-closure diagnostic still appears in successful runs.

No production migration, deployment, DNS operation or billing action is part of
this PR.

## Changed files

- `README.md`
- `apps/web/src/app/(auth)/layout.tsx`
- `apps/web/src/app/(workspace)/apps/page.tsx`
- `apps/web/src/app/(workspace)/categories/page.tsx`
- `apps/web/src/app/(workspace)/dashboard/page.tsx`
- `apps/web/src/app/(workspace)/pages/page.tsx`
- `apps/web/src/app/(workspace)/products/page.tsx`
- `apps/web/src/app/(workspace)/stores/[storeId]/page.tsx`
- `apps/web/src/app/(workspace)/stores/new/page.tsx`
- `apps/web/src/app/(workspace)/stores/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/workspace.css`
- `apps/web/src/components/auth-form.tsx`
- `apps/web/src/components/dashboard-overview.tsx`
- `apps/web/src/components/markets.tsx`
- `apps/web/src/components/operation-form.tsx`
- `apps/web/src/components/order-operations.tsx`
- `apps/web/src/components/orders-view.tsx`
- `apps/web/src/components/shell.tsx`
- `apps/web/src/components/store-settings-editor.tsx`
- `docs/ui/workspace-dashboard-desktop.png`
- `docs/ui/workspace-order-detail-tablet.png`
- `docs/ui/workspace-products-desktop.png`
- `docs/ui/workspace-settings-mobile.png`
- `docs/workspace-ui-refinement.md`
- `packages/ui/src/index.tsx`
- `tests/e2e/ux.spec.ts`
