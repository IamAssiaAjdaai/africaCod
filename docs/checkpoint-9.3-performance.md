# Checkpoint 9.3 performance report

Measurements use Chrome and an isolated local PostgreSQL database. The fixture is a real Owner workspace, one published Kenya Store, one active Product/offer (KES 3,990), a published Product Page and 30 seeded COD Orders. Probe checkouts create additional real Orders; no live merchant database or worker is used. Both provider/tracking test adapters are disabled during profiling. This is a small local dataset, not a load test.

The before artifact is commit `aea83f9`. After measurements use the Checkpoint 9.3 implementation. Five warm samples are reported as medians; raw samples are in [the JSON record](checkpoint-9.3-performance.json). Full-document timings run from browser navigation through visible main heading. Production soft navigation measures existing Next Links and verifies unchanged `performance.timeOrigin`. No improvement is inferred from query-count reductions alone.

## Development runtime

| Route                                     | Before median ms | After median ms | Statements per render |
| ----------------------------------------- | ---------------: | --------------: | --------------------: |
| /dashboard                                |             2352 |            1538 |               36 → 25 |
| /stores/[storeId]/settings                |             2434 |            1177 |               50 → 17 |
| /products                                 |             1454 |             760 |               19 → 10 |
| /orders                                   |             1495 |            1565 |                16 → 9 |
| /analytics                                |             1209 |            1682 |                14 → 8 |
| /s/profiling-store?market=KE              |             1117 |            1779 |                13 → 5 |
| /s/profiling-store/p/hair-serum?market=KE |             1383 |            1083 |                12 → 8 |

Dashboard and Settings improved in this sample. Orders was approximately flat, and Analytics/public Store were slower despite fewer statements. Public Product measurements were repeated after removing its validation fallback import. These results do **not** establish that every route became faster. CPU/filesystem load and development background compilation vary; repeated cold compilations appeared inside nominally warm sequences.

## Measured root causes and retained changes

- Repeated authentication and tenant membership reads in layouts/pages/domain calls. Session and persisted membership reads now deduplicate within the React render request; authorization and role checks remain enforced. No cross-request tenant cache is introduced.
- Public metadata/layout/browse called the same Store projection repeatedly, with inconsistent omitted versus explicit-undefined arguments defeating a cache. The read boundary normalizes arguments and shares one request-scoped projection, keyed by slug and authenticated Preview user where applicable.
- Setup loaded full Product/Market/organization-offer collections and Settings computed it twice. Readiness uses bounded tenant-scoped SQL `exists` checks, and the page/card reuse the result.
- Dashboard fetched 20 rows per queue to display five. Queries now fetch five while full Orders pages retain 20; independent rows/count reads execute together. The nine grouped operational overview queries remain server-side and unchanged.
- Draft saves invalidated the public layout unnecessarily. Public invalidation now runs only on Publish.
- Public Product imported the validation barrel solely for fallback defaults, although the domain always provides validated settings. Removing that import keeps server validation intact. Rate limiting uses an explicit small domain export instead of the general barrel.

## Cold compilation and development environment

Server ready time was roughly 1.4–1.6 seconds, but first-hit route work was much slower. The baseline successful sign-up request took **32.4 seconds**, including **30.4 seconds** reported by Next as compilation/framework work. A retained after-run took **32.2 seconds** (30.7 seconds framework work); after the bundler comparison invalidated development caches, another took **81 seconds** (77 seconds framework work). These are first-route measurements after process restart with existing caches, not a controlled empty-cache comparison. Cold compilation is **not proven fixed**.

Next reported slow-filesystem benchmarks of 271–607 ms in observed development runs. The host also had unrelated VM/Chrome activity. The precise cause of the filesystem delay is not established. Proxy warm handling was typically single/tens of milliseconds and only forwards a request ID. Application instrumentation logs startup/error events; it does not perform per-navigation filesystem traversal. The inherited DEBUG flag only explains Next's “testMode” startup diagnostic; application mock flags remained disabled.

Webpack was measured and rejected as the default: Dashboard median 2,646 ms, Settings 3,295 ms, Orders 2,822 ms, with public first-hit requests around 55–67 seconds. Server-library externalization produced an unusable timeout and was removed. No warnings were suppressed. A port-conflicted profiling attempt was discarded; the harness now owns a process group, verifies readiness and cleans up all its server children.

## Production runtime

Production timings are measured from a real optimized `next build` artifact started locally with staging configuration. This separates optimized runtime from development compilation; it does not claim live TLS/S3/courier readiness. Five-sample warm medians:

| Route          | Before ms | After ms |
| -------------- | --------: | -------: |
| Dashboard      |       778 |      633 |
| Store Settings |       748 |      602 |
| Products       |       596 |      498 |
| Orders         |       866 |      688 |
| Analytics      |       504 |      450 |
| Public Store   |       596 |      574 |
| Public Product |       555 |      284 |

Existing Next Link navigation (five samples, all remained in the same document):

| Destination    | Before ms | After ms |
| -------------- | --------: | -------: |
| Dashboard      |       429 |      463 |
| Store Settings |       334 |      342 |
| Orders         |       410 |      403 |
| Public Store   |       880 |      863 |
| Public Product |       455 |      412 |

Full-document navigation improved in this final sample. Soft navigation remains mixed: Dashboard/Settings were slightly slower, while Orders/public Store/Product were slightly faster. This **does not establish a broad soft-navigation speedup**. The final timing run disables query logging to match the older production implementation. A separate after-run with markers is retained in the JSON for transparency; its Dashboard/Settings soft medians were 995/433 ms and its Product soft median was 899 ms. Changing host load, prefetch/analytics and diagnostic overhead limit causal interpretation. Public production statement counts include background requests and cannot establish render-only counts; development render counts above provide that comparison. Zero markers in uninstrumented runs mean logging was disabled, not zero SQL reads. Probe checkouts also grow the small fixture between runs. No host or production-scale guarantee follows from these samples.

Warm checkout HTTP medians were **134 → 97 ms** (three samples after first request). Draft Save server actions measured **1089 → 1155 ms** over five samples, including response and UI completion: no improvement is established for that action. The first production baseline had only one Save sample (956 ms); the repeated baseline is used for this comparison. Development checkout warm medians were **552 → 286 ms**; development Draft Save had one baseline sample (2278 ms) versus five after samples (median 1733 ms), so that action comparison is limited.

A separately verified optimized baseline Product request delivered **924,961 decoded JavaScript bytes**; the final after request delivered **522,995 bytes** (43.5% less). This is ResourceTiming's decoded transfer accounting for the same Product path, not gzip wire bytes or a complete bundle analyzer. Removing the redundant client validation import reduced browser work without moving validation out of the server. Development ResourceTiming sometimes recorded zero bytes due to cache/HMR; those entries are not zero-sized bundle claims.

## Reproduction

Use Node 22 and the repository's pnpm version. Profiling requires local PostgreSQL and installed Chrome. The helper refuses production application configuration and uses only `africacod_profile_test`, leaving development workers and application data untouched.

```sh
pnpm exec tsx scripts/profile-checkpoint.ts setup
pnpm exec tsx scripts/profile-checkpoint.ts dev before
# Apply the changes, migrate the isolated fixture and create an optimized build.
pnpm exec tsx scripts/profile-checkpoint.ts migrate
pnpm build
PROFILE_QUERY_COUNT=0 pnpm exec tsx scripts/profile-checkpoint.ts production after
```

`setup` refuses an existing database. Reports/fixture identifiers are written under `/tmp`; no credentials or cookies are recorded. `DATABASE_QUERY_PROFILE=1` is enabled only for the helper's non-production local server and logs statement markers, never SQL or parameters. Production application mode always disables these markers. Use `PROFILE_QUERY_COUNT=0` for uninstrumented timing runs; default profiling enables statement markers. Use a free port 3200. Run the before/after profiles sequentially without concurrent builds/tests for a less noisy comparison.

Functional acceptance should continue with the simplified first-run flow and the optimized production artifact. Cold development compilation/filesystem behavior remains a separate concern; no blanket latency or scalability guarantee is claimed.
