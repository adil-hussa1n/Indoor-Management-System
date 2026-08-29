# Phase 0 Research: Shared-Database, JWT-Derived Business Tenancy

## Current architecture (as found in code, 2026-08-28)

- **Two Sequelize connections, structurally**: `server/src/config/master-db.js`
  (`masterSequelize`, DB `indoor_master_db`) and
  `server/src/config/sequelize.js` (`getTenantConnection(dbName)`, a `Map`
  of one live `Sequelize` instance per tenant database, e.g. `db_apexarena`,
  plus one unused "legacy" default export).
- **Models are re-defined per connection**: `server/src/models/model-factory.js`
  (`createModels(sequelize)`) defines the full tenant-scoped schema — 17
  models: `Admin`, `Booking`, `BookingStatusHistory`, `BookingRequest`,
  `Ground`, `Slot`, `SlotLock`, `User`, `OTP`, `Review`, `Gallery`,
  `Contact`, `Settings`, `AuditLog`, `BlockedCustomer`, `FinanceCategory`,
  `FinanceEntry` — against whichever `sequelize` instance is passed in, and
  caches the result per `sequelize.config.database` name. `Admin.username`,
  `User.phone`, and `BlockedCustomer.phone` all carry **table-level unique
  constraints today** (safe only because each tenant has its own table).
- **Tenant resolution**: `server/src/middlewares/tenant.js`
  (`tenantMiddleware`) runs on every `/api/v1/*` request, extracts a slug
  from the hostname (prod) or an `X-Tenant-Slug` header / `?tenant=` query
  param (dev), looks it up in the master `Tenant` table (5-minute in-memory
  cache), enforces subscription-expiry suspension, obtains/creates a
  Sequelize connection for that tenant's DB, calls `createModels()`, and —
  on first use of a connection — runs a large block of ad hoc
  `ALTER TABLE ... ADD COLUMN` statements plus `sequelize.sync()` plus
  index/default-row provisioning. Attaches `req.tenant`, `req.tenantDb`,
  `req.models`.
- **Repository layer**: `server/src/repositories/repository-factory.js`
  (`createRepositories(models)`) wraps every model in a small repository
  object. **Every read/write method already takes an explicit `where`
  (or `data`) object as its first argument(s)**, sourced from the
  request-bound `req.models`, not imported globally. This is the key
  leverage point for the migration (see Decision 2 below).
- **Auth**: `server/src/middlewares/auth.js`'s `protect` decodes a JWT
  containing `{ id, tenant: <slug>, type }`, checks
  `decoded.tenant === req.tenant.slug` (a defense against a token being
  replayed against a different subdomain than it was issued for), then
  looks the admin up via `req.repos.adminRepo.findById(decoded.id)`
  (already tenant-scoped because `req.repos` was built from the
  tenant-bound `req.models`). `jwt.sign()` is called in 4 places:
  `auth.controller.js:24` (admin login), `auth.controller.js:386` (a second
  admin-auth path — confirm during implementation whether this is
  password-reset/refresh or a duplicate login path), `tenant.controller.js:34`
  and `:186` (Super Admin auth, unrelated to per-business scoping),
  and `user-auth.routes.js:161` (customer OTP login).
- **Provisioning**: `tenant.controller.js`'s `createTenant` does, in order:
  validate slug → check for slug collision in master `Tenant` table →
  `CREATE DATABASE IF NOT EXISTS db_<slug>` → insert a `Tenant` row →
  `getTenantConnection` + `createModels` + `syncDatabase()` against the new
  DB → create the tenant's first `Admin` row in that new DB.
- **Testing**: no test framework is configured (`package.json` has no
  `test` script beyond the placeholder `npm test`, no Jest/Mocha/Vitest
  dependency, no `tests/`/`__tests__/` directory, no `.sequelizerc` or
  `migrations/`/`seeders/` directories — schema changes are applied via
  `sequelize.sync()` plus raw `ALTER TABLE` statements at request time, not
  versioned migration files).

## Decisions

### Decision 1: One Sequelize connection, defined once at boot
**Chosen**: Replace `getTenantConnection(dbName)` / `master-db.js`'s dual
connections with a single `sequelize` instance created once at application
boot (`server/src/config/db.js`, already present but currently only a
16-line stub — confirm during implementation whether it's dead code or
partially wired in), pointed at one shared database. `createModels()` is
called exactly once against that instance at boot, not per-request.
**Rationale**: Matches constitution Principle I.1. Removes the entire
per-tenant connection-pool cache, `_synced` first-use flag, and the runtime
`ALTER TABLE`/`sync()` block in `tenant.js` — those become one-time,
version-controlled migration scripts (Decision 4) run before deploy, not
request-time side effects.
**Alternatives considered**: Keep per-connection pooling but point every
tenant's "connection" at the same physical DB (same host/port/dbName) —
rejected as pure waste; it keeps all the tenant-connection-cache machinery
alive for zero benefit once there's only one database.

### Decision 2: Scope at the repository layer via a `businessId`-injecting wrapper, not by rewriting every controller call site
**Chosen**: Because every repository method already threads an explicit
`where`/`data` object rather than querying a model directly, add one small
wrapper — `withBusinessScope(repositories, businessId)` — that intercepts
each repository method and merges `{ businessId }` into the `where` clause
of every read and the `data` object of every `create`, before delegating to
the existing repository-factory functions unchanged. `injectRepositories`
middleware calls this wrapper using `req.businessId` instead of passing
`req.models` from a per-tenant connection.
**Rationale**: This is the smallest correct diff. It reuses the entire
existing repository-factory file (401 lines, 15 repositories) rather than
hand-editing every `where: {...}` literal across ~10 controllers, while
still guaranteeing every query is scoped (Principle I.4) at one single
choke point — auditable and testable in isolation (the isolation test suite
in Phase 1 tests this wrapper directly).
**Alternatives considered**: (a) Manually add `businessId` to every `where`
clause at every call site in every controller — rejected: much larger
diff, far easier to miss one call site and leave a cross-tenant leak, harder
to verify exhaustively. (b) Sequelize `defaultScope` per model
(`Model.addScope('business', ...)` set per-request) — rejected: Sequelize
default scopes are defined once on the model class, not safely
re-parameterizable per-request for a single shared model instance across
concurrent requests for different businesses; would require either
re-defining models per request (defeats Decision 1) or manual scope
application anyway, so it doesn't save the wrapper.

### Decision 3: Identifier guard as Express middleware inspecting `req.body`
**Chosen**: One middleware, applied to every write route (mounted globally
on `POST`/`PUT`/`PATCH` under `/api/v1`, after body parsing and before any
controller), that rejects with 400 if `req.body` contains `businessId`,
`tenantId`, `adminId`, or `userId` — naming the offending key(s) in the
error message.
**Rationale**: Matches constitution Principle II and the sibling repos'
`IdentityGuardMixin`/`EnforceJWTIdentifiers` pattern, applied platform-wide
at the framework layer rather than per-controller.
**Alternatives considered**: A per-route Zod/Joi schema addition — rejected
as the primary mechanism (existing validators like `loginSchema` are
per-route and easy to forget on a new route); may still be layered on
individual schemas for defense-in-depth in a later feature, but the global
middleware is the enforced floor.

### Decision 4: Versioned, ordered migration scripts (Sequelize CLI or hand-written SQL scripts), not ad hoc `ALTER TABLE`
**Chosen**: Introduce a `server/migrations/` directory with numbered,
ordered scripts corresponding exactly to the five-phase rollout in
`plan.md`'s Project Structure section, replacing the try/catch
`ALTER TABLE` block currently embedded in `tenant.js`.
**Rationale**: A live-data migration with FK backfill and eventual
`NOT NULL` + FK-constraint tightening needs to run in a controlled, ordered,
re-runnable way outside request-time — this is a correctness requirement
of the migration itself (spec Assumption: no data loss), not just a style
preference.
**Alternatives considered**: Sequelize's `sync({ alter: true })` for the
whole migration — rejected: `alter: true` can silently drop/recreate
columns/indexes in ways that are unsafe for a live-data cutover; explicit
SQL/CLI migrations give reviewable, ordered control over each destructive
step (e.g. adding `NOT NULL` only after backfill is verified complete).

### Decision 5: Minimal real-execution test suite using Jest + Supertest against the migrated shared-DB app
**Chosen**: Add `jest` and `supertest` as dev dependencies (none currently
present) with a single focused test file proving the core isolation
property end-to-end: seed two `Business` rows with overlapping data shapes,
authenticate as each, and assert cross-business reads/writes are rejected
per spec User Story 1 and 4 (`server/tests/tenant-isolation.test.js`),
run against a real (test) MySQL database — not mocked — matching this
workspace's "verify against a real execution path" discipline.
**Rationale**: The constitution and spec both require this guarantee to be
*verifiable*, not just reviewed; a real Express app + real MySQL test DB
run via `supertest` is the minimal setup that proves it end-to-end rather
than unit-testing the `withBusinessScope` wrapper in isolation (which could
pass while still missing a call site the wrapper wasn't applied to).
**Alternatives considered**: Testing only the `withBusinessScope` wrapper
function in isolation with mocked repositories — rejected as insufficient:
it would prove the wrapper works but not that every route actually goes
through it, which is the actual risk this migration introduces.

## Open items resolved (no NEEDS CLARIFICATION remain)

- **`auth.controller.js:386`'s second `jwt.sign()` call**: treated as an
  implementation-time investigation item (confirm its exact purpose — likely
  password-reset-confirmation or a manager-invite acceptance flow) rather
  than a planning blocker; whatever it is, it must be updated to embed
  `businessId` the same way the primary login path is (Decision covered by
  FR-002/FR-013 in spec.md), and is called out explicitly as a task.
- **`server/src/config/db.js`'s current 16-line stub**: implementation must
  first confirm whether anything already imports it (a `grep` shows it is
  not currently wired into `app.js`'s startup — likely dead scaffolding);
  Decision 1's single boot-time connection will either repurpose this file
  or replace it, confirmed at task time rather than blocking planning.
