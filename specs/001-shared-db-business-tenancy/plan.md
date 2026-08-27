# Implementation Plan: Shared-Database, JWT-Derived Business Tenancy

**Branch**: `001-shared-db-business-tenancy` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-shared-db-business-tenancy/spec.md`

## Summary

Replace Indoor-Management-System's per-tenant-database, subdomain-routed
architecture with a single shared MySQL database and JWT-derived
`businessId` row-level tenant scoping, matching `business_backend` and
`restaurant_backend`. The existing repository layer already threads an
explicit `where`/`data` object through every method (see `research.md`
Decision 2), which lets the migration scope every query through one shared
wrapper instead of hand-editing every controller call site. The rollout is
phased — additive schema, data backfill, constraint tightening, middleware
swap, then removal of the old machinery — because this is a live-data
migration for two currently-operating tenants, not a greenfield build.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js (per `server/package.json`, `"type": "module"`)

**Primary Dependencies**: Express 4, Sequelize 6, MySQL2, jsonwebtoken, bcryptjs, zod (validators), socket.io

**Storage**: MySQL — collapsing from N per-tenant databases + 1 master database to 1 shared database

**Testing**: Jest + Supertest (new — none currently configured; see `research.md` Decision 5), run against a real MySQL test database, not mocks

**Target Platform**: Docker container on the existing VPS/deployment target (no infra topology change required by this feature beyond removing dead per-tenant-DB provisioning code)

**Project Type**: Web application (`server/` Express API + `client/` React SPA); this feature is backend-only, with minimal client changes to stop sending tenant-slug headers on authenticated requests

**Performance Goals**: No regression vs. current per-request tenant-connection-lookup path; a single persistent connection pool should if anything reduce per-request overhead (no more first-use `ALTER TABLE`/`sync()` checks, no tenant-cache lookups)

**Constraints**: Zero data loss (spec SC-001); at most one forced re-login per session at cutover (spec Assumptions) — no extended downtime window budgeted beyond that

**Scale/Scope**: 2 live tenants at time of writing (`dbox`, `cagindoor` per `SaaS_Architecture.md`) plus any provisioned before cutover; 17 business-owned Sequelize models; ~10 controllers/~15 repositories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Shared-DB, JWT-Derived Business Tenancy | This feature's entire purpose is implementing this principle | ✅ by construction |
| II. No Client-Supplied Identifiers | Identifier-guard middleware planned (research.md Decision 3) | ✅ planned |
| III. Cross-Business Reference Integrity | FK validation targets enumerated in data-model.md | ✅ planned |
| IV. Business Provisioning Without Physical DB Creation | Phase 5 replaces `createTenant`'s `CREATE DATABASE` call | ✅ planned |
| V. Hostname Resolution Is Public-Storefront-Only | contracts/README.md scopes `X-Tenant-Slug`/hostname to public routes only | ✅ planned |
| VI. RBAC Is Business-Scoped | `Admin.role`/`permissions` untouched; `Admin` gains `businessId` like every other model | ✅ preserved, not rebuilt |
| VII. Universal Server-Driven Pagination | In scope: shared pagination helper replacing `booking.controller.js`'s `limit=10` default and other ad hoc `limit` handling | ✅ planned (task-level) |
| VIII. Timezone (Asia/Dhaka) & English-Only | In scope: audit of date-range/report logic | ✅ planned (task-level) |
| IX. Soft-Delete Discipline | In scope: audit of dashboard/report aggregations for `isActive` filtering | ✅ planned (task-level) |
| X. Two-Phase Deletion | Existing hard-delete paths (if any) audited during implementation; no new violation introduced by this feature | ✅ no new gate risk |

No unjustified violations. Complexity Tracking table below is empty — the
one piece of added complexity (the `withBusinessScope` repository wrapper)
is justified in `research.md` Decision 2 as the mechanism that keeps the
diff auditable, not an incidental complication.

## Project Structure

### Documentation (this feature)

```text
specs/001-shared-db-business-tenancy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── README.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root: `Indoor-Management-System/`)

```text
server/
├── src/
│   ├── config/
│   │   ├── db.js                 # becomes the single shared-DB connection (currently a stub — confirm wiring)
│   │   ├── sequelize.js          # per-tenant connection pool — REMOVED in Phase 5
│   │   └── master-db.js          # master DB connection — REMOVED in Phase 5 (folded into db.js)
│   ├── models/
│   │   ├── model-factory.js      # called once at boot instead of per-request; models gain businessId
│   │   └── master/
│   │       ├── Tenant.js         # becomes Business.js, moved out of master/ (no longer a separate DB concept)
│   │       ├── SuperAdmin.js     # stays cross-business, moves into shared DB
│   │       └── SubscriptionHistory.js  # stays cross-business, moves into shared DB
│   ├── middlewares/
│   │   ├── tenant.js             # REPLACED by businessContext.js (JWT-derived, no hostname lookup on authenticated routes)
│   │   ├── auth.js               # `protect` updated: businessId claim, no tenant-slug mismatch check
│   │   ├── injectRepositories.js # updated to call withBusinessScope(repos, req.businessId)
│   │   └── identityGuard.js      # NEW — Principle II enforcement
│   ├── repositories/
│   │   ├── repository-factory.js # UNCHANGED (Decision 2 — this is the leverage point that stays stable)
│   │   └── scope.js              # NEW — withBusinessScope() wrapper
│   └── controllers/
│       ├── tenant.controller.js  # createTenant/etc. rewritten per Phase 5 (no CREATE DATABASE)
│       ├── auth.controller.js    # jwt.sign() calls emit businessId instead of tenant slug
│       └── booking.controller.js # pagination default fixed (Principle VII)
├── migrations/                    # NEW — versioned, ordered (see Rollout Phases below)
│   ├── 001-create-business-table.js
│   ├── 002-add-nullable-business-id-columns.js
│   ├── 003-composite-unique-constraints.js  # applied post-backfill
│   └── 004-business-id-not-null-and-fk.js   # applied post-backfill
├── scripts/
│   └── backfill-business-data.js  # NEW — data migration from per-tenant DBs into shared DB
└── tests/
    └── tenant-isolation.test.js   # NEW — Jest + Supertest, real MySQL test DB

client/
└── src/
    └── (remove any X-Tenant-Slug / ?tenant= sending on authenticated requests; confirm exact call sites at task time)
```

**Structure Decision**: Existing `server/` + `client/` layout is kept as-is.
This feature only adds `server/migrations/`, `server/scripts/`, and
`server/tests/` (all currently absent) and modifies files in place — no new
top-level project split.

## Rollout Phases (ordering is load-bearing — see spec Assumptions: no data loss, one re-login interruption max)

1. **Additive schema on the shared DB** — create `Business` table; add
   `businessId` columns as **nullable** to every business-owned model in
   the shared database (which starts empty or is created fresh). No
   existing per-tenant database is touched yet. Old app code keeps running
   unaffected against the old per-tenant databases during this phase.
2. **Data backfill** — `scripts/backfill-business-data.js` reads every row
   from each existing per-tenant database (`db_dbox`, `db_cagindoor`, …),
   inserts a corresponding `Business` row (from that tenant's `Tenant` row)
   if not already created, and copies every business-owned table's rows
   into the shared database with `businessId` populated — remapping primary
   keys where two source tenants collide (spec Edge Cases), preserving
   referential integrity across the remap. Verified via row-count and
   spot-check reconciliation (SC-001) before proceeding.
3. **Tighten constraints** — once backfill is verified complete and
   reconciled, alter `businessId` columns to `NOT NULL`, add FK constraints
   to `Business.id`, and convert the single-column unique constraints
   (`Admin.username`, `User.phone`, `BlockedCustomer.phone`) to composite
   (`businessId`, ...) uniqueness per `data-model.md`.
4. **Swap the middleware/auth layer** — deploy the new
   `businessContext` middleware (JWT-derived `req.businessId`),
   `identityGuard` middleware, `withBusinessScope` repository wrapper, and
   updated `jwt.sign()` calls (`businessId` claim). This is the cutover
   point: every session's existing token (old `tenant` claim shape) becomes
   invalid and forces one re-login (spec FR-013, Assumptions).
5. **Remove old machinery** — delete `tenant.js`'s hostname/slug resolution
   for authenticated routes, `sequelize.js`'s per-tenant connection pool,
   `master-db.js`, the `CREATE DATABASE`/`syncDatabase()` provisioning path
   in `tenant.controller.js`'s `createTenant`, and the `tenantCache`. Retire
   the now-unused per-tenant physical databases only after a verified
   observation window post-cutover (operational/deploy timing is the user's
   call, not automated by this feature).

Phases 1–3 are purely additive/backfill and can run with zero downtime.
Phase 4 is the single user-facing cutover point. Phase 5 is cleanup and has
no functional effect once Phase 4 is stable.

## Complexity Tracking

*No unjustified Constitution Check violations — table intentionally empty.*
