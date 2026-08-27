# Tasks: Shared-Database, JWT-Derived Business Tenancy

**Input**: Design documents from `/specs/001-shared-db-business-tenancy/`
**Prerequisites**: plan.md, data-model.md, research.md, contracts/README.md, quickstart.md

**Implementation status (2026-08-28, updated same day — second pass)**: The
architectural cutover (Phases 1, 2, 3's schema/constraint work, and the
middleware/auth layer of Phase 5) was implemented and verified end-to-end
against real MySQL instances (two separate throwaway Docker containers) —
`npm test` passes 7/7, and `node migrations/run.js` was run twice from a
completely fresh database (once catching and fixing a real bug: Sequelize's
default `ON DELETE SET NULL` on the `Business` FK conflicted with
`businessId NOT NULL` until `onDelete: 'RESTRICT'` was added in
model-factory.js). `businessId` is now genuinely `allowNull: false` in the
model (T019 fully closed, not just planned) — migrations 001 and 002 both
verified idempotent and safe to run against a fresh shared database.
Cross-business FK validation (T027) extended beyond booking→ground to
finance entries (categoryId, groundId) and slot→ground. Timezone audit
(T048) found and fixed three real UTC-vs-Asia/Dhaka bugs in the dashboard
(`getDashboardData`'s today/tomorrow/7-days-ago/month-boundary
calculations) via a new shared `server/src/utils/timezone.js`; the rest of
the codebase (booking/slot availability) was already Dhaka-aware. Soft-delete
audit (T049): no violations found — `Booking`/`Review` already use
Sequelize `paranoid: true` (auto-excludes soft-deleted rows from every
query), and `FinanceEntry` has no soft-delete concept to violate.
Architecture docs rewritten (T044: README.md, SaaS_Architecture.md,
Subdomain_and_DNS_Configuration.md, root workspace CLAUDE.md). An additional
batch of pre-existing dead legacy repository files
(`src/repositories/{admin,booking,contact,gallery,review,settings,slot}.repository.js`)
was also found and removed — unreferenced anywhere, importing model files
already deleted in the first pass.

**Still open** — genuinely blocked on production access, not a choice:
the real data backfill (T012–T016) against the live per-tenant databases
(`db_apexarena`, `db_dbox`, …) requires production credentials this
environment does not have, and running it against real customer data
without the user watching would be an unsupervised high-stakes action.
`server/scripts/backfill-business-data.js` and
`server/scripts/verify-backfill.js` are written and ready — they need to be
run by the user against real infrastructure, per quickstart.md. Also open:
remaining FK-validation call sites beyond the ones listed above (e.g.
`BookingRequest.bookingId`/`userId`), and client-side changes (T033 — though
analysis found none are strictly required: the client's existing
`X-Tenant-Slug` header is now simply inert once a JWT is present, by
design).

**Organization note**: This feature is a live-data migration, not a
greenfield build — plan.md's five rollout phases are ordering-critical
(additive schema → backfill → constraint tightening → middleware/auth
cutover → removal of old machinery), so tasks are organized by rollout
phase rather than by independently-parallel user stories. Each task is
still tagged `[USn]` where it serves a specific spec.md user story, for
traceability. Tests are included per research.md Decision 5 (constitution
requires verifiable isolation guarantees, not review-only).

## Phase 1: Setup

- [ ] T001 Add `jest`, `supertest`, and (if not already present) a MySQL
      test-database bootstrap script to `server/package.json` devDependencies
      and `scripts` (`"test": "jest --runInBand"`), per research.md Decision 5.
- [ ] T002 [P] Create `server/migrations/` directory and a small migration
      runner script (`server/migrations/run.js`, or adopt `sequelize-cli` if
      already implied by existing `sequelize` version) that applies numbered
      migration files in order and records which have run (a `SchemaMigrations`
      table is sufficient — no need for a heavier framework).
- [ ] T003 [P] Create `server/scripts/` directory for `backfill-business-data.js`.
- [ ] T004 [P] Create `server/tests/` directory with a Jest config
      (`server/jest.config.js`) pointed at a dedicated test database
      (`DB_NAME` override via `.env.test`), matching this workspace's
      "run the suite on a real MySQL instance" discipline.
- [ ] T005 Confirm whether `server/src/config/db.js` is currently imported
      anywhere (`grep -rn "config/db.js" server/src`); document the finding
      in a one-line comment at the top of the file so Phase 4/5 tasks know
      whether they are repurposing live code or replacing dead scaffolding
      (research.md "Open items resolved").

**Checkpoint**: Test/migration tooling exists; no application code changed yet.

---

## Phase 2: Foundational — Additive Schema (Rollout Phase 1)

**Goal**: Create the shared database's `Business` table and add nullable
`businessId` columns everywhere, without touching any existing per-tenant
database or existing request-handling code path.

- [ ] T006 Create `server/src/models/Business.js`: port every field from
      `server/src/models/master/Tenant.js` except `dbName`, per data-model.md's
      `Business` entity table (`slug` unique, `businessName`, `adminEmail`,
      `adminPhone`, `isActive`, `plan`, `subscriptionExpiresAt`,
      `customDomain` unique, `smsCredentials`, `subscriptionPrice`,
      `subscriptionPlan`, `totalRevenueCollected`, `paymentStatus`,
      `lastPaymentDate`, `allowPaymentGateway`), `tableName: 'businesses'`.
- [ ] T007 [P] Move `server/src/models/master/SuperAdmin.js` and
      `server/src/models/master/SubscriptionHistory.js` to
      `server/src/models/SuperAdmin.js` / `server/src/models/SubscriptionHistory.js`
      (cross-business models that live in the shared DB per data-model.md,
      update their imports and `server/src/models/master/index.js` re-exports
      or remove `master/index.js` if now empty).
- [ ] T008 `server/migrations/001-create-business-table.js`: migration that
      creates the `businesses` table (mirrors T006's model) against the new
      single shared database (`DB_NAME`).
- [ ] T009 `server/migrations/002-add-nullable-business-id-columns.js`:
      migration adding a **nullable** `businessId INTEGER` column (no FK yet)
      to every table listed in data-model.md's "Modified entities" section:
      `admins`, `bookings`, `booking_status_history`, `booking_requests`,
      `grounds`, `slots`, `slot_locks`, `users`, `otps`, `reviews`, `gallery`,
      `contacts`, `settings`, `audit_logs`, `blocked_customers`,
      `finance_categories`, `finance_entries`.
- [ ] T010 In `server/src/models/model-factory.js`, add `businessId:
      { type: DataTypes.INTEGER, allowNull: true }` (nullable for now — T031
      tightens it later) to all 17 model definitions listed in T009, and add
      `belongsTo(Business, { foreignKey: 'businessId' })` associations for
      each (no FK constraint enforced at the DB level until Phase 4/T031).
- [ ] T011 [P] Update `server/src/models/model-factory.js`'s doc comment
      (currently "Creates all tenant-scoped models bound to a specific
      Sequelize instance... across different tenant databases") to reflect
      that it is now called once at boot against the single shared
      connection, per research.md Decision 1.

**Checkpoint**: Shared DB schema exists additively. Existing app still runs
unmodified against old per-tenant databases — this phase is a no-op for
running traffic.

---

## Phase 3: Foundational — Data Backfill (Rollout Phase 2)

**Goal**: Move every row from the existing per-tenant databases into the
shared database with `businessId` populated, with zero data loss (spec
SC-001) and a documented, collision-safe primary-key remap where two
tenants' tables collide (spec Edge Cases).

- [ ] T012 [US3] `server/scripts/backfill-business-data.js`: for each row in
      the master `Tenant` table (`db_<slug>` per tenant), create/find the
      corresponding `Business` row in the shared DB (reusing `Tenant`'s
      fields per T006), and record a `{ tenantSlug: oldDbName, businessId }`
      mapping.
- [ ] T013 [US3] Extend `backfill-business-data.js`: for each tenant's
      per-tenant database, connect directly (reusing the pre-migration
      `getTenantConnection` pattern in read-only fashion) and, for each of
      the 17 business-owned tables (T009's list), copy every row into the
      shared database's equivalent table, setting `businessId` to that
      tenant's `Business.id`. Remap primary keys with an offset/UUID
      strategy when a source `id` would collide with an already-inserted
      row from a different tenant in the same target table; update all
      FK columns referencing the remapped `id` (`bookings.groundId`,
      `slots.groundId`, `booking_requests.bookingId`, etc.) consistently
      within the same tenant's batch.
- [ ] T014 [US3] Add a `--dry-run` mode to `backfill-business-data.js` that
      reports per-table source vs. would-be-inserted row counts without
      writing, for use in T015's verification step.
- [ ] T015 [US3] `server/scripts/verify-backfill.js`: reconciliation script
      comparing, per tenant per table, the source per-tenant-DB row count
      against the shared-DB row count filtered by that tenant's `businessId`
      — must match exactly for every table before Phase 4 proceeds (spec
      SC-001). Spot-checks at least one full row's field-for-field equality
      per table.
- [ ] T016 [US3] Run `backfill-business-data.js` against a restored copy of
      production data (not production directly) and run `verify-backfill.js`
      against the result; fix any discrepancy found before continuing.

**Checkpoint**: Shared DB contains every existing tenant's data, verified
complete and correctly attributed. Old per-tenant databases are still the
live source of truth for running traffic — this phase is still a no-op for
current users.

---

## Phase 4: Foundational — Constraint Tightening (Rollout Phase 3)

**Goal**: Once backfill is verified (T016), make `businessId` structurally
required and fix the uniqueness constraints that only worked by accident of
per-tenant-DB isolation.

- [ ] T017 `server/migrations/003-composite-unique-constraints.js`: drop the
      single-column unique index on `admins.username`, `users.phone`, and
      `blocked_customers.phone`; add composite unique indexes on
      (`businessId`, `username`) and (`businessId`, `phone`) respectively,
      per data-model.md's uniqueness table. Run against the backfilled
      shared DB and confirm no duplicate-key errors occur (would indicate
      an unremapped collision missed in Phase 3).
- [ ] T018 `server/migrations/004-business-id-not-null-and-fk.js`: alter all
      17 `businessId` columns from T009 to `NOT NULL`, and add FK
      constraints to `businesses.id` (with `ON DELETE RESTRICT` — a business
      must be explicitly deactivated via `isActive`, never cascade-deleted).
- [ ] T019 [P] Update `server/src/models/model-factory.js`: change all 17
      `businessId` field definitions from `allowNull: true` to
      `allowNull: false`, matching T018's DB-level constraint.

**Checkpoint**: Database now structurally enforces Principle I.2 — no row
can exist without a `businessId`. Old per-tenant DBs and the middleware/auth
layer are still what's actually serving traffic; this phase completes the
data-layer half of the migration before the cutover in Phase 5.

---

## Phase 5: User Story 1 — Admin Sees Only Their Own Business's Data (Priority: P1) — Middleware/Auth Cutover (Rollout Phase 4)

**Goal**: Swap the request-handling layer over to JWT-derived `businessId`
scoping. This is the user-facing cutover point (spec FR-013: existing
sessions are invalidated, one re-login required).

**Independent Test**: Per spec.md — seed two businesses with overlapping
data shapes, log in as each admin, confirm every endpoint returns only that
business's rows; confirm a client-supplied `businessId` in a write body is
rejected; confirm a cross-business FK write is rejected.

- [ ] T020 [P] [US1] `server/src/config/db.js`: implement (or replace, per
      T005's finding) the single shared-DB Sequelize connection, created
      once at module load, using the same connection-pool options currently
      in `server/src/config/sequelize.js`'s `createConnection()`.
- [ ] T021 [US1] `server/app.js` / boot sequence: call
      `createModels(sequelize)` from `server/src/models/model-factory.js`
      exactly once at application startup (not per-request) using T020's
      connection; export the resulting `models` object for direct import.
- [ ] T022 [US1] `server/src/repositories/scope.js` (NEW): implement
      `withBusinessScope(repositories, businessId)` per research.md Decision
      2 — wraps every method on every repository object returned by
      `createRepositories(models)` (`server/src/repositories/repository-factory.js`,
      unchanged) so that every `where` argument is merged with
      `{ businessId }` and every `create`/`data` argument is merged with
      `{ businessId }` before delegating to the original method.
- [ ] T023 [US1] `server/src/middlewares/businessContext.js` (NEW,
      replaces the authenticated-route responsibilities of `tenant.js`):
      decode the JWT (reusing the verification logic from
      `server/src/middlewares/auth.js`'s `protect`), read `decoded.businessId`,
      look up the `Business` row, reject 401 if the business doesn't exist
      or `isActive` is false (spec Edge Cases / FR-014), reject 403 if
      `subscriptionExpiresAt` + 7-day grace has passed (porting the existing
      grace-period logic from `tenant.js`'s `tenantMiddleware`), and attach
      `req.businessId`.
- [ ] T024 [US1] `server/src/middlewares/auth.js`: update `protect` to no
      longer compare `decoded.tenant === req.tenant.slug`; instead rely on
      `businessContext` (T023) having already run, and simply verify
      `decoded.businessId === req.businessId` as a defense-in-depth replay
      check (mirrors the old mismatch check's intent with the new claim
      shape).
- [ ] T025 [US1] `server/src/middlewares/injectRepositories.js`: replace
      `req.repos = createRepositories(req.models)` with
      `req.repos = withBusinessScope(createRepositories(models), req.businessId)`
      (T022's wrapper, T021's boot-time `models`), and update its "tenant
      context not initialized" guard to check `req.businessId` instead of
      `req.models`.
- [ ] T026 [US1] [P] `server/src/middlewares/identityGuard.js` (NEW): Express
      middleware rejecting any `POST`/`PUT`/`PATCH` request whose `req.body`
      contains `businessId`, `tenantId`, `adminId`, or `userId`, with the
      400 response shape from contracts/README.md; mount it globally in
      `server/app.js` after body parsing, before route registration, per
      constitution Principle II.
- [ ] T027 [US1] [P] Cross-business FK validation: add a small shared
      validator (`server/src/utils/validateSameBusiness.js`) used by
      controllers/repositories for each FK pair listed in data-model.md's
      "Cross-business FK integrity targets" table (`Booking.groundId`,
      `Booking.userId`, `Slot.groundId`, `SlotLock.groundId`,
      `BookingRequest.bookingId`/`userId`, `FinanceEntry.categoryId`/`groundId`,
      `BookingStatusHistory.bookingId`); wire it into
      `server/src/controllers/booking.controller.js`, `slot.controller.js`,
      `finance.controller.js`, and any other controller performing a
      create/update against these FKs, returning 400 per contracts/README.md
      on mismatch.
- [ ] T028 [US1] `server/src/controllers/auth.controller.js`: update both
      `jwt.sign()` calls (line ~24 primary admin/manager login, and the
      second call around line ~386 — first confirm its exact purpose per
      research.md's open item, then update it identically) to embed
      `businessId: req.businessId` instead of `tenant: req.tenant.slug`.
- [ ] T029 [US1] `server/src/routes/user-auth.routes.js`: update the
      customer OTP-login `jwt.sign()` call (line ~161) to embed `businessId`
      instead of `tenant: req.tenant.slug`, and replace its direct
      `req.tenantDb.models.User`/`.Booking`/`.BookingRequest` calls (lines
      ~89, ~113, ~117, ~122, ~136, ~148, ~152) with `req.repos.userRepo`/
      `req.repos.bookingRepo`/`req.repos.bookingRequestRepo` equivalents
      (adding any missing repository methods to
      `server/src/repositories/repository-factory.js` if needed) so this
      route goes through the scoped repository layer like every other route.
- [ ] T030 [US1] `server/app.js`: replace the `tenantMiddleware,
      injectRepositories` mount on `/api/v1` with `businessContext,
      injectRepositories` (T023, T025); keep `tenant.js`'s hostname/slug
      resolution available for Phase 6's public-storefront routes only
      (do not delete the file yet — that's Phase 7/T038).
- [ ] T031 [US4] Verify RBAC composes correctly with the new scoping: no
      code change expected (`requirePermission`/`requirePrimaryAdmin` in
      `auth.js` already operate on `req.admin` populated after
      `businessContext`/`protect` run), but trace the middleware order in
      every route file under `server/routes/` and `server/src/routes/` to
      confirm `businessContext` → `protect` → `requirePermission` always
      runs in that order.
- [ ] T032 [P] [US1] [US3] [US4] `server/tests/tenant-isolation.test.js`:
      Jest + Supertest suite against a real test MySQL DB (T004) seeding two
      `Business` rows with overlapping data (per quickstart.md), asserting:
      (a) Admin A's list endpoints never return Business B's rows; (b) a
      write with a client-supplied `businessId` is rejected 400 (T026);
      (c) a `Booking` create referencing another business's `groundId` is
      rejected 400 (T027); (d) a manager scoped to Business A is rejected
      when attempting any action against Business B's data even with a
      valid token (US4); (e) an old-shape JWT (`tenant` claim, no
      `businessId`) is rejected (FR-013).
- [ ] T033 [P] `client/src`: locate and remove every place the frontend
      sends `X-Tenant-Slug` or `?tenant=` on an **authenticated** request
      (grep `client/src` for `X-Tenant-Slug`, `tenant slug`, or similar);
      confirm the JWT is sent via `Authorization: Bearer` alone for those
      requests. Leave any such header/param intact only on calls to public,
      unauthenticated storefront endpoints (Phase 6).

**Checkpoint**: This is the live cutover. All existing sessions must
re-authenticate once (spec Assumptions). Run T032's full suite green before
considering this phase done — this is the primary spec.md deliverable
(User Stories 1 and 4).

---

## Phase 6: User Story 2 — Provisioning Without New Database (Priority: P1)

**Independent Test**: Provision a new tenant through the Super Admin panel
against the migrated environment; confirm no new MySQL database appears and
the new admin can log in to an empty, correctly-scoped dashboard.

- [ ] T034 [US2] `server/src/controllers/tenant.controller.js`'s
      `createTenant`: remove the `masterSequelize.query(\`CREATE DATABASE
      IF NOT EXISTS...\`)` call (~line 262), the `getTenantConnection`/
      `createModels`/`syncDatabase()` block (~lines 287-289), and the
      `dbName` generation/validation logic; replace with: create a
      `Business` row (T006's model) in the shared DB, then create the first
      `Admin` row with `businessId` set to the new `Business.id` (reusing
      the existing `bcrypt.hash` + role logic at ~lines 292-299 unchanged).
- [ ] T035 [US2] Update `Tenant.findOne({ where: { slug } })` slug-collision
      check (~line 246) to query the new `Business` model instead of the
      removed `Tenant` model.
- [ ] T036 [P] [US2] `server/tests/tenant-isolation.test.js` (extend T032):
      add a provisioning test asserting `POST /api/master/tenants` creates
      exactly one `Business` + one `Admin` row and issues no `CREATE
      DATABASE` statement (assert via a MySQL `information_schema.schemata`
      count before/after, per quickstart.md's manual validation steps).

**Checkpoint**: Super Admin provisioning flow fully matches spec User Story 2.

---

## Phase 7: User Story 5 — Public Storefront Still Resolves by Hostname (Priority: P3)

**Independent Test**: Fetch the public storefront for two different
subdomains and confirm each shows only its own branding; confirm hostname/
`X-Tenant-Slug` has no effect on any authenticated route.

- [ ] T037 [US5] Identify every currently-public, unauthenticated route
      (public settings/branding lookup, gallery, reviews-list, availability
      check — audit `server/routes/*.js` and `server/src/routes/*.js` for
      routes mounted before `protect`/`requirePermission`) and keep them
      resolving their target business via `tenant.js`'s existing
      hostname/`X-Tenant-Slug`/`?tenant=` extraction logic, but change the
      lookup target from the old `Tenant` model to the new `Business` model
      and attach only `req.publicBusinessId` (not `req.businessId`, to keep
      it structurally distinct from the JWT-derived value per Principle V).
- [ ] T038 `server/src/middlewares/tenant.js`: strip out everything except
      the slug-extraction + `Business` lookup used by T037's public routes
      (remove the per-tenant-DB connection/model-factory/ALTER-TABLE/sync
      block entirely — that machinery has no purpose once Phase 5 is live);
      rename the trimmed file/export to reflect its narrowed public-only
      role (e.g. `publicBusinessLookup.js`) and update T037's route mounts.
- [ ] T039 [P] [US5] `server/tests/tenant-isolation.test.js` (extend):
      assert a public settings/branding endpoint resolves correctly per
      subdomain header, and assert sending that same header alongside a
      valid `Authorization` bearer token on an authenticated route has no
      effect on which business's data is returned (contracts/README.md).

**Checkpoint**: Public storefront branding still works; hostname resolution
is provably inert for authenticated routes.

---

## Phase 8: Cleanup — Remove Old Machinery (Rollout Phase 5)

**Goal**: Delete now-dead per-tenant-database code. No functional effect if
Phase 5 is stable — pure removal.

- [ ] T040 [P] Delete `server/src/config/sequelize.js`'s per-tenant
      `getTenantConnection`/`tenantConnections` Map/`removeTenantConnection`/
      `closeAllConnections` machinery (superseded by T020's single
      connection); keep only what T020 actually reused.
- [ ] T041 [P] Delete `server/src/config/master-db.js` (folded into T020's
      `db.js`); update any remaining imports.
- [ ] T042 [P] Delete `server/src/models/master/Tenant.js` (superseded by
      T006's `Business.js`) and remove the now-empty `server/src/models/master/`
      directory (T007 already moved `SuperAdmin`/`SubscriptionHistory` out).
- [ ] T043 Remove the `tenantCache`/`resolveTenant`/`ensureMasterColumns`
      helpers left over in `tenant.js`/`publicBusinessLookup.js` if T038
      didn't already remove them; confirm no remaining reference to
      `req.tenantDb` or `req.models` (the pre-migration per-request shape)
      exists anywhere in `server/src` or `server/routes` (`grep -rn
      "req.tenantDb\|req.models" server`).
- [ ] T044 Update `README.md`, `SaaS_Architecture.md`, and
      `Subdomain_and_DNS_Configuration.md` at the repo root to describe the
      shared-database/JWT-derived-`businessId` architecture instead of the
      retired per-tenant-database model, per constitution Governance
      section (these docs currently contradict the ratified constitution).

**Checkpoint**: No trace of the per-tenant-database architecture remains in
code or docs.

---

## Phase 9: Polish & Workspace-Standard Retrofits

**Goal**: Constitution Principles VII–IX are workspace-wide standards this
repo didn't previously meet, independent of the tenancy migration itself —
tracked as their own group per plan.md's Constitution Check.

- [ ] T045 [P] `server/src/utils/paginate.js` (NEW): shared pagination
      helper — default page size 20, max 100 — matching
      `business_backend`/`restaurant_backend`'s `StandardResultsSetPagination`
      standard (constitution Principle VII).
- [ ] T046 [US-N/A] `server/src/controllers/booking.controller.js` (~line
      304): replace the ad hoc `const { page = 1, limit = 10, ... } =
      req.query` with T045's shared helper (default 20, max 100).
- [ ] T047 [P] Audit every other list endpoint for ad hoc `limit`/`page`
      handling (`groundRepo.findAll({}, { limit: 1 })` at ~line 198/450 and
      similar call sites found via `grep -rn "limit" server/src/controllers`)
      and replace with T045's helper where it's a genuine list endpoint
      (leave intentional single-row lookups like `{ limit: 1 }` for "first
      ground" fallback alone — those aren't pagination).
- [ ] T048 [P] Timezone audit (constitution Principle VIII): grep
      `server/src` for `new Date()`, `Date.now()`, and any UTC-implicit date
      math used in booking-date logic, subscription-expiry checks
      (`businessContext.js`'s grace-period calc from T023), and report
      date-range filters; convert to explicit `Asia/Dhaka`-local evaluation
      (e.g. via a shared `dhakaNow()`/`toDhakaDate()` utility in
      `server/src/utils/timezone.js`, NEW).
- [ ] T049 [P] Soft-delete aggregation audit (constitution Principle IX):
      grep `server/src/controllers` for dashboard/report/finance summary
      queries (`finance.controller.js`, any booking-revenue aggregation in
      `booking.controller.js`) and confirm each filters `isActive: true` (or
      the paranoid-delete equivalent for `paranoid: true` models like
      `Booking`/`Review`) — add the filter anywhere it's missing.
- [ ] T050 Run the full `npm test` suite (T032/T036/T039) plus a manual pass
      through quickstart.md's validation steps end-to-end; confirm all spec.md
      Success Criteria (SC-001 through SC-006) are met before calling this
      feature done.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → no dependencies, can start immediately.
- **Phase 2 (Additive Schema)** → depends on Phase 1 (T001-T004 tooling).
- **Phase 3 (Backfill)** → depends on Phase 2 completing (schema must exist
  before rows can be inserted); T012-T016 are sequential within this phase.
- **Phase 4 (Constraint Tightening)** → depends on Phase 3's T016
  verification passing (constraints only tighten safely once backfill is
  confirmed complete).
- **Phase 5 (Middleware/Auth Cutover, US1/US4)** → depends on Phase 4
  completing (the app cannot enforce `req.businessId` scoping against a
  column that isn't guaranteed present/non-null yet). This is the
  user-facing cutover.
- **Phase 6 (Provisioning, US2)** → depends on Phase 5 (`Business` model
  and scoped `Admin` creation must exist).
- **Phase 7 (Public storefront, US5)** → depends on Phase 5 (needs the
  distinction between `req.businessId` and public hostname resolution to
  exist first) but is otherwise independent of Phase 6.
- **Phase 8 (Cleanup)** → depends on Phase 5/6/7 all being stable in
  production (do not delete old machinery before the cutover has been
  running successfully for an observation window — operational timing is
  the user's call).
- **Phase 9 (Polish)** → independent of the tenancy migration's phase
  ordering; can be worked in parallel with Phases 6-8 once Phase 5 lands,
  since it touches different concerns (pagination/timezone/soft-delete) in
  mostly disjoint files.

## Parallel Execution Examples

- Within Phase 2: T007, T011 can run in parallel with T006/T008-T010 (different files).
- Within Phase 5: T026 (identityGuard) and T027 (FK validator) are independent new files — parallelizable with each other and with T020/T021 (different files), but all must land before T030's route-mount swap.
- Phase 9 (T045-T049) is almost entirely parallelizable — five independent audit/utility tasks across different files, gated only on Phase 5 being merged first (so the audits run against the new scoping model, not the old one).

## Suggested MVP Scope

Phases 1-5 (through T033) constitute the MVP: the shared database exists,
data is migrated and verified, and the middleware/auth layer enforces
`businessId` scoping — spec User Stories 1 and 4 (the core safety property)
are met and tested. Phases 6-9 (provisioning polish, public storefront
verification, cleanup, and workspace-standard retrofits) are valuable but
can follow incrementally without leaving the system in a broken or
partially-migrated state.
