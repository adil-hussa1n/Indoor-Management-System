<!--
Sync Impact Report:
- Version change: (none, template) -> 1.0.0 (MAJOR: initial ratification — this repo previously had no constitution and an architecture inconsistent with its sibling products; this document establishes binding principles for the first time, including a structural tenancy-model change.)
- Modified principles: n/a (initial version)
- Added sections:
  - Principle I: Shared-Database, JWT-Derived Business Tenancy (Non-Negotiable)
  - Principle II: No Client-Supplied Identifiers
  - Principle III: Cross-Business Reference Integrity
  - Principle IV: Business Provisioning Without Physical Database Creation
  - Principle V: Hostname Resolution Is Public-Storefront-Only
  - Principle VI: Role-Based Access Control Is Business-Scoped
  - Principle VII: Universal Server-Driven Pagination
  - Principle VIII: Timezone (Asia/Dhaka) & English-Only Locale
  - Principle IX: Soft-Delete Discipline in Reporting & Aggregations
  - Principle X: Two-Phase Deletion Discipline
  - Technology Stack
  - Governance
- Removed sections: none (initial version)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — generic Constitution Check gate references this file; no repo-specific edits needed
  - ✅ .specify/templates/spec-template.md — no repo-specific edits needed
  - ✅ .specify/templates/tasks-template.md — no repo-specific edits needed
  - ⚠ pending — README.md, SaaS_Architecture.md, Subdomain_and_DNS_Configuration.md still describe the pre-migration DB-per-tenant architecture; these MUST be rewritten as part of the migration work tracked in specs/, not as a constitution side-effect
- Follow-up TODOs: none — all placeholders resolved from user-supplied decisions.
-->
# Indoor-Management-System Constitution

## Core Principles

### I. Shared-Database, JWT-Derived Business Tenancy (NON-NEGOTIABLE)
This system serves multiple tenant businesses (e.g. "Apex Arena", "D-Box") from
**one single production MySQL database**, using the same row-level tenancy
model as this workspace's sibling products (`business_backend`,
`restaurant_backend`). The prior architecture — one physical database per
tenant (`db_apexarena`, `db_dbox`, …), a separate `indoor_master_db` tenant
registry, and per-request Sequelize connection switching driven by parsing
the request subdomain or an `X-Tenant-Slug` header — is retired.
1. **One Database**: There is exactly one MySQL database for this service in
   each environment. No code path may open, cache, or route queries through a
   second, tenant-specific database connection. Any `getTenantConnection()`-
   style per-tenant connection factory, the `tenantCache`, and the dynamic
   `createModels(tenantDb)` per-connection model factory are removed.
2. **`businessId` on Every Business-Owned Model**: Every business-owned
   Sequelize model — including but not limited to `Booking`, `Ground`,
   `Slot`, `Settings`, `Admin`, `Gallery`, `Review`, `Contact`,
   `BlockedCustomer`, `FinanceEntry`, `FinanceCategory`, `AuditLog`,
   `BookingRequest`, `Payment` — MUST carry a required `businessId` foreign
   key column referencing a `Business` row. The former master-DB `Tenant`
   model becomes an ordinary table (`Business`) inside the single shared
   database, analogous to `business.Business` in `business_backend` and
   `restaurant_backend`.
3. **JWT Is the Only Trusted Tenant-Scope Source**: A JWT is issued per
   `(business, admin)` at login and carries a `businessId` claim, replacing
   the prior `tenant: <slug>` claim. A single global Express middleware —
   the functional equivalent of Django's `BusinessJWTContextMiddleware` /
   `JWTAuthentication` — decodes this JWT once per authenticated request and
   attaches `req.businessId` and `req.adminId` (or `req.userId` for customer
   sessions) to the request context. This is the **only** trusted source of
   tenant scope anywhere in the codebase; no other mechanism (hostname,
   header, query param, request body) may establish tenant scope for an
   authenticated route.
4. **Every Query Is Scoped Server-Side**: Every repository/controller read
   or write MUST filter by `req.businessId` (or the equivalent scoped
   parameter derived from it) — never by a tenant identifier read from the
   request body, query params, or a header. Repositories MUST NOT expose a
   method that queries across all businesses without an explicit, clearly
   named super-admin-only code path.
5. **Deleted Machinery**: The subdomain tenant-resolution middleware
   (`tenantMiddleware`'s slug-extraction and DB-lookup logic), the wildcard-
   DNS / Nginx `X-Tenant-Slug` request flow as a scoping mechanism, and the
   runtime `CREATE DATABASE db_<slug>` / per-tenant schema-sync provisioning
   flow are removed entirely and MUST NOT be reintroduced.

### II. No Client-Supplied Identifiers
`businessId`, `tenantId`, and `adminId` (or `userId`) MUST NEVER be accepted
from a client-supplied request body, header, or query parameter on any
write endpoint, under any circumstance — matching `business_backend`
Principle II and `restaurant_backend` Principle III. This is enforced by a
single shared validation layer (an Express middleware or a Joi/Zod schema
mixin applied uniformly to every write route) that inspects the parsed
request body of every `POST`/`PUT`/`PATCH` request and rejects it with
`400` naming every offending field if any of these identifiers are present.
This guard MUST be applied platform-wide through one shared mechanism, not
copy-pasted or re-implemented ad hoc per controller.

### III. Cross-Business Reference Integrity
Any foreign key on a business-owned model that references another
business-owned model (e.g. a `Booking`'s `groundId`, a `FinanceEntry`'s
`categoryId`) MUST be validated at write time (create and update) to
confirm the referenced row belongs to the same `businessId` as the record
being saved. A record MUST NEVER be creatable or updatable such that it
references another business's data. This is absolute, with zero exceptions,
mirroring `restaurant_backend` Principle III.5 — cross-business data leakage
is never an acceptable risk to mitigate; it MUST be structurally impossible.
Read/report/dashboard endpoints that aggregate across related tables MUST
independently verify `businessId` on every row they include rather than
assuming write-time validation was correctly applied everywhere (defense in
depth, mirroring `restaurant_backend` Principle III.6).

### IV. Business Provisioning Without Physical Database Creation
Provisioning a new tenant (formerly: Super Admin creates a `Tenant` row,
triggers `CREATE DATABASE db_<slug>`, and runs a schema-sync/seed pass
against that new database) becomes a plain row-insert transaction against
the single shared database: create one `Business` row and its first `Admin`
row, both scoped by the new `Business`'s primary key. No new physical
database, connection, or schema-sync step is created or required. Existing
per-tenant data currently split across separate physical databases MUST be
migrated into the shared database with a backfilled `businessId` on every
row as part of the migration work — data migration scripts are a required
deliverable of this transition, not an implementation detail left
unspecified.

### V. Hostname Resolution Is Public-Storefront-Only
Resolving which business a request is for via the request hostname/subdomain
(e.g. `apexarena.daruntech.com`) MAY continue to exist, but strictly limited
to **unauthenticated, public storefront routes** (branding lookup: business
name, logo, colors, hero banner shown to an anonymous visitor before
login). Any such hostname-based lookup MUST resolve to a `businessId` and
go no further — it MUST NOT be used to scope authenticated data, and MUST
NOT set any Sequelize connection, cache key, or authorization context. Every
authenticated route (admin dashboard, bookings, finances, staff management,
customer account) resolves its business scope exclusively from the JWT per
Principle I.3, matching how `business_frontend`/`restaurant_frontend`
resolve their single tenant from the authenticated session rather than the
hostname.

### VI. Role-Based Access Control Is Business-Scoped
This system's existing RBAC model — `Admin.role` of `'admin'` (primary
business owner, unrestricted) or `'manager'` (restricted to specific
permission keys), enforced via `requirePermission(key)` and
`requirePrimaryAdmin` middleware over a per-admin JSON permission matrix
(`bookings`, `calendar`, `finances`, `slots`, `grounds`, `requests`,
`blacklist`, `reviews`, `messages`, `gallery`, `settings`, `auditLogs`) — is
retained and formalized as a first-class principle of this system. Every
`Admin` row (including managers) is itself a business-owned model scoped by
`businessId` under Principle I.2: a manager account created under one
business MUST NEVER authenticate against or act on another business's data,
regardless of role or permission grants. This RBAC layer has no equivalent
in `business_backend`/`restaurant_backend` today; it is a strength unique to
this product and MUST be preserved through the tenancy migration, not
discarded in the name of alignment.

### VII. Universal Server-Driven Pagination
Every list endpoint MUST paginate server-side through one shared pagination
helper, matching the workspace-wide standard already binding on
`business_backend` and `restaurant_backend`: default page size **20**,
maximum page size **100**, applied uniformly. Ad hoc per-controller
`limit`/`page` handling (e.g. `booking.controller.js`'s current
`limit = 10` default) is a violation and MUST be replaced by the shared
helper. Unpaginated list responses are prohibited.

### VIII. Timezone (Asia/Dhaka) & English-Only Locale
This system serves a Bangladesh-based tenant market. There is exactly one
locale in production use: English. All server-side date/time logic —
booking slot dates, subscription expiry checks, report date ranges,
"today"/dashboard-window calculations — MUST evaluate against `Asia/Dhaka`
local time, not UTC or server-local time, matching `restaurant_backend`
Principle II. Any date-range or daily-aggregation query that currently
relies on UTC day boundaries MUST be corrected as part of the alignment
work.

### IX. Soft-Delete Discipline in Reporting & Aggregations
Every dashboard summary, financial report, revenue total, and export row
builder (finance summaries, booking revenue aggregates, occupancy reports)
MUST filter on `isActive = true` (or the model's equivalent active-state
field) for every table it aggregates over. Soft-deleted bookings, finance
entries, grounds, or other business-owned rows MUST NEVER inflate a total or
appear in a report, matching `business_backend` Principle VI.2 and
`restaurant_backend` Principle III's aggregation-isolation requirement.

### X. Two-Phase Deletion Discipline
For every business-owned entity that supports deletion (e.g. `Ground`,
`Admin`/staff, `FinanceCategory`, `Slot`), hard-delete MUST only be
reachable after the record has already been soft-deleted
(`isActive = false`) — a record that is still active MUST NEVER be
hard-deleted directly, regardless of how the request is made. Where a
record still has dependent children (e.g. a `Ground` with existing
`Booking`s, a `FinanceCategory` with existing `FinanceEntry` rows),
hard-delete MUST be rejected outright rather than cascading, mirroring
`business_backend` Principle IV and `restaurant_backend` Principle IX. This
guarantee MUST be enforced once, in a single shared deletion helper reused
by every controller that supports hard-delete — not reimplemented per
route.

## Technology Stack

Backend: Node.js + Express, Sequelize ORM, MySQL (single shared production
database per Principle I), JWT auth (`jsonwebtoken`), deployed via Docker.
Frontend: React 19 + Vite + Tailwind CSS 4, `@tanstack/react-query`, Axios.
Directory layout: `server/` (Express app, `src/controllers`,
`src/repositories`, `src/models`, `src/middlewares`, `routes/`) and
`client/` (Vite SPA). This stack's own idiomatic Express/Sequelize
conventions govern response envelopes, error handling, and migration
tooling — alignment with `business_backend`/`restaurant_backend` is scoped
to the tenancy, identity-enforcement, pagination, timezone, and soft-delete
principles above, not to imitating Django/DRF idioms in a Node codebase.

## Governance

This constitution is authoritative for `Indoor-Management-System` and
supersedes any conflicting description of this repo's architecture in the
root workspace `CLAUDE.md`, and in this repo's own `README.md`,
`SaaS_Architecture.md`, and `Subdomain_and_DNS_Configuration.md` until those
documents are rewritten to match — where those documents describe the
pre-migration DB-per-tenant architecture, this constitution's Principle I
governs. Amendments require a stated reason, an update to this file, and a
semantic version bump (MAJOR for removing/redefining a principle, MINOR for
adding one, PATCH for wording/clarity). All specs, plans, and tasks in
`specs/` MUST be consistent with Principles I–X before being accepted.

**Version**: 1.0.0 | **Ratified**: 2026-08-28 | **Last Amended**: 2026-08-28
