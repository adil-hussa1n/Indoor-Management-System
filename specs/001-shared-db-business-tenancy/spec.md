# Feature Specification: Shared-Database, JWT-Derived Business Tenancy

**Feature Branch**: `001-shared-db-business-tenancy`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "Migrate Indoor-Management-System's backend from its current per-tenant-database, subdomain-routed architecture to a single shared MySQL database with JWT-derived businessId row-level tenant scoping, matching business_backend and restaurant_backend, per constitution v1.0.0."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin logs in and only ever sees their own business's data (Priority: P1)

A venue admin (e.g. "Apex Arena") logs into the admin dashboard. Every screen
they see — bookings, grounds, slots, finances, staff, reviews, messages —
shows only Apex Arena's data, even though Apex Arena's rows now live in the
same physical database as every other tenant's rows. No configuration,
subdomain, or header the admin's browser sends is what keeps their data
isolated — it is derived solely from their signed-in session.

**Why this priority**: This is the core safety property of the whole
migration. If this doesn't hold, the migration has failed regardless of
whether anything else works.

**Independent Test**: Seed two businesses in the shared database with
overlapping data shapes (both have a "Court 1" ground, both have bookings on
the same date). Log in as each business's admin in turn and confirm every
list/detail/report endpoint returns only that business's rows.

**Acceptance Scenarios**:

1. **Given** two businesses exist in the shared database, **When** Admin A
   logs in and requests their bookings list, **Then** only Business A's
   bookings are returned, regardless of how many other businesses' bookings
   exist in the same table.
2. **Given** Admin A is authenticated, **When** they send a request with a
   `businessId` field in the body pointing at Business B, **Then** the
   request is rejected (400) and no data crosses between businesses.
3. **Given** Admin A is authenticated, **When** they attempt to create a
   `Booking` referencing a `groundId` that belongs to Business B, **Then**
   the write is rejected (400).

---

### User Story 2 - Super Admin provisions a new tenant without creating a new database (Priority: P1)

The Super Admin fills in the existing tenant-provisioning form (business
name, subdomain slug, admin credentials, initial pricing/branding). Today
this triggers `CREATE DATABASE db_<slug>` and a schema sync. After this
migration, the identical Super Admin flow results in one new `Business` row
and one new `Admin` row inserted into the single shared database — no new
database is created, and the new tenant is immediately usable.

**Why this priority**: This is the second half of the architectural change
(provisioning), and it's the flow that would break first and most visibly if
the migration is incomplete — a Super Admin trying to onboard a client is a
production-critical path.

**Independent Test**: Provision a new tenant through the Super Admin panel
against a freshly migrated environment and confirm no new MySQL database
appears, the new business's admin can immediately log in, and their
dashboard is empty (not error, not another tenant's data).

**Acceptance Scenarios**:

1. **Given** the Super Admin submits the provisioning form, **When** the
   request completes, **Then** exactly one new `Business` row and one new
   `Admin` row exist in the shared database, and no new physical database
   was created.
2. **Given** a newly provisioned business, **When** its admin logs in for
   the first time, **Then** they see an empty (not error, not cross-tenant)
   dashboard scoped to their own new `businessId`.

---

### User Story 3 - Existing tenant data survives the migration intact (Priority: P1)

The two live tenants that exist today (e.g. "dbox", "cagindoor") continue to
operate after the migration with all of their existing bookings, grounds,
slots, staff accounts, finance entries, reviews, and audit history intact
and correctly attributed to their own business — nothing is lost, duplicated,
or reassigned to the wrong tenant.

**Why this priority**: Data loss or misattribution during this migration is
irreversible and directly affects real, currently-operating businesses.

**Independent Test**: Run the data-migration script against a copy of
production data; compare row counts and spot-checked record content
per-table between the pre-migration per-tenant databases and the
post-migration shared database.

**Acceptance Scenarios**:

1. **Given** the pre-migration per-tenant databases each have N rows in a
   given table, **When** the migration script runs, **Then** the shared
   database's equivalent table has the same total row count across all
   migrated tenants, each row correctly tagged with its origin tenant's
   `businessId`.
2. **Given** two source tenant databases each had a row with primary key
   `id=1` in the same table, **When** both are migrated into the shared
   database, **Then** both rows exist distinctly (via remapped primary keys
   or an equivalent collision-safe strategy) with no data overwritten.

---

### User Story 4 - Manager with restricted permissions still only reaches allowed modules within their own business (Priority: P2)

A manager account (role `manager`, granted only `bookings` and `calendar`
permissions) logs in. They can use those two modules for their own business
and are blocked from restricted modules (finances, staff, settings) — and,
as with the primary admin, cannot reach any other business's data no matter
what they try.

**Why this priority**: Confirms the existing RBAC system, which the
constitution requires to be preserved, keeps working correctly once layered
onto the new `businessId`-scoped `Admin` model — RBAC and tenancy scoping
must compose correctly, not just each work in isolation.

**Independent Test**: Log in as a manager with a partial permission set and
attempt both an allowed action and a forbidden action, for their own
business and (via crafted requests) another business.

**Acceptance Scenarios**:

1. **Given** a manager has only `bookings` permission, **When** they call a
   finances endpoint, **Then** they receive 403 regardless of business.
2. **Given** a manager belongs to Business A, **When** they present a valid
   token and attempt any action scoped to Business B, **Then** they are
   rejected the same way Admin A would be (User Story 1, Scenario 2).

---

### User Story 5 - Public storefront visitor sees correct branding without any authenticated data leaking (Priority: P3)

An anonymous customer visits `apexarena.daruntech.com`. The public booking
page shows Apex Arena's branding, grounds, and available slots. This
hostname-based lookup exists only to identify which business's public
content to show; it grants no access to any authenticated data, and no
authenticated request from this or any other browser is ever scoped by
hostname.

**Why this priority**: Lower priority because it's a narrower, well-isolated
surface (public read-only branding/availability), but still must be
verified so the hostname-resolution carve-out doesn't quietly become a
backdoor into authenticated scoping.

**Independent Test**: Fetch the public storefront for two different
subdomains and confirm each shows only its own branding/availability; then
confirm that no authenticated endpoint honors a hostname or subdomain header
as a scoping input.

**Acceptance Scenarios**:

1. **Given** two tenants exist, **When** an anonymous visitor loads each
   subdomain, **Then** each sees only their own business's public branding
   and slot availability.
2. **Given** an authenticated request for Business A's admin, **When** the
   request is sent with a `Host`/`X-Tenant-Slug` header naming Business B,
   **Then** the response is still scoped to Business A (the header is
   ignored for authenticated routes).

### Edge Cases

- What happens when a JWT is valid but its `businessId` claim references a
  business that no longer exists (deleted/deprovisioned)? The request MUST
  be rejected, not silently scoped to zero rows.
- What happens when two previously separate tenant databases have colliding
  primary keys on the same table during data migration? IDs MUST be
  remapped collision-safely; the migration MUST document and verify the
  remapping rather than silently overwriting one tenant's row with another's.
- What happens when an existing manager's permission JSON references a
  module key that no longer exists after migration? The system MUST treat
  an unrecognized permission key as "no access" rather than erroring or
  granting access.
- What happens when a cross-business FK write is attempted with a
  `groundId`/`categoryId`/etc. that doesn't exist at all (not just belongs
  to another business)? It MUST be rejected the same way as a cross-business
  reference — a 400, not a 500 or a silent null.
- What happens to in-flight/expired tenant-scoped JWTs issued before the
  migration (carrying the old `tenant: slug` claim, no `businessId` claim)?
  They MUST be rejected as invalid post-migration, forcing re-login, rather
  than being partially trusted.
- What happens when the Super Admin suspends or deactivates a business
  post-migration? Every admin/manager/customer session tied to that business
  MUST lose access on their next authenticated request, matching today's
  subscription-expiry suspension behavior but enforced via `businessId`
  instead of the tenant registry lookup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store all tenant businesses' data in a single
  shared database rather than one physical database per tenant.
- **FR-002**: System MUST derive the acting business's identity for every
  authenticated request exclusively from a signed JWT claim, never from a
  request hostname, header, query parameter, or request body.
- **FR-003**: System MUST reject any authenticated write request whose body
  contains a client-supplied business, tenant, or user/admin identifier
  field, returning an error that names the offending field(s).
- **FR-004**: System MUST reject any write that would create or update a
  record referencing another business's data through a foreign key
  relationship (e.g. a booking referencing another business's ground).
- **FR-005**: System MUST scope every list/detail/report/aggregation
  endpoint to the authenticated request's business — no endpoint may return
  or aggregate another business's rows.
- **FR-006**: System MUST allow Super Admin provisioning of a new business
  without creating a new physical database or running per-tenant schema
  migration/sync steps.
- **FR-007**: System MUST preserve the existing role/permission model
  (primary admin vs. permission-scoped manager) after migration, with
  manager accounts continuing to be restricted to their granted modules
  within their own business only.
- **FR-008**: System MUST paginate every list endpoint server-side with a
  consistent default and maximum page size, replacing any endpoint-specific
  pagination defaults that differ from the shared standard.
- **FR-009**: System MUST evaluate all date-based business logic (slot
  availability by date, subscription expiry, report date ranges, "today"
  calculations) in the business's local timezone (Asia/Dhaka) consistently,
  regardless of server or database default timezone.
- **FR-010**: System MUST exclude soft-deleted (inactive) records from every
  dashboard summary, financial report, and revenue/occupancy total.
- **FR-011**: System MUST migrate all existing tenant data from the current
  per-tenant databases into the shared database, preserving every record and
  its correct business attribution, with no data loss.
- **FR-012**: System MUST continue to resolve a business for anonymous,
  unauthenticated public storefront requests via hostname/subdomain, limited
  strictly to public branding and availability data — this hostname
  resolution MUST NOT be usable to scope any authenticated request.
- **FR-013**: System MUST invalidate/reject JWTs issued under the prior
  tenant-slug-based scheme once the migration is live, requiring affected
  sessions to re-authenticate.
- **FR-014**: System MUST reject any request whose JWT references a business
  that does not exist or has been deactivated.

### Key Entities

- **Business**: A tenant venue operator (e.g. "Apex Arena"). Replaces the
  prior master-database `Tenant` registry entry; becomes an ordinary
  row-owning record in the shared database that every business-owned record
  references. Carries the identity, branding, subscription/lifecycle state,
  and settings previously held on `Tenant`.
- **Admin**: A staff account (primary owner or permission-scoped manager)
  belonging to exactly one `Business`. Authenticates and receives a JWT
  scoped to that `Business`.
- **Business-owned records** (Booking, Ground, Slot, Settings, Gallery,
  Review, Contact, BlockedCustomer, FinanceEntry, FinanceCategory,
  AuditLog, BookingRequest, Payment, and any other record type discovered
  during planning to be tenant-specific): every such record belongs to
  exactly one `Business` and is only ever visible to, or writable by, an
  authenticated session scoped to that same `Business`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing tenant records (bookings, grounds, slots,
  staff, finance entries, reviews, audit logs) are present and correctly
  attributed to their originating business after migration — zero data loss,
  verified by row-count and spot-check reconciliation.
- **SC-002**: An authenticated user can never retrieve or modify another
  business's data through any endpoint, verified by an isolation test suite
  covering every list/detail/write endpoint with two seeded businesses.
- **SC-003**: Provisioning a new tenant completes without creating any new
  physical database, verified by observing the database server's schema list
  before and after provisioning.
- **SC-004**: Every list endpoint returns a bounded page (default 20, max
  100 records) with no endpoint capable of returning an unbounded result set.
- **SC-005**: All existing live tenants ("dbox", "cagindoor", and any others
  active at migration time) remain fully operational immediately after
  cutover, with their admins able to log in and see their own data with no
  manual per-tenant intervention required post-migration.
- **SC-006**: Manager accounts with restricted permissions are blocked from
  disallowed modules 100% of the time, in both same-business and
  cross-business attempts.

## Assumptions

- The two currently-live tenants ("dbox", "cagindoor" per `SaaS_Architecture.md`)
  are the full universe of production data that must be migrated; any
  additional tenants provisioned before the migration executes must also be
  included and are covered by the same migration process.
- A brief authenticated-session interruption (forcing re-login once, per
  Edge Cases/FR-013) at cutover is acceptable; the business is not required
  to design a zero-downtime dual-write migration path.
- The response envelope shape (`{success, message, data}`) and general REST
  route layout are out of scope for this feature and are preserved as-is —
  this feature changes how data is scoped and stored, not the API's outward
  contract shape.
- The React client (`client/`) requires only the minimum changes needed to
  keep working against the migrated API (e.g. no longer needing to send a
  tenant-slug header/param for authenticated requests) — a broader client
  rewrite is out of scope.
- Infrastructure/deployment changes (DNS, Nginx config, Docker topology)
  beyond removing the now-dead per-tenant-database provisioning code path
  are out of scope for this feature and remain the user's own call to
  trigger and monitor.
- "Business-owned records" needing a `businessId` column include, at
  minimum, the models named in this feature's input (Admin, Booking, Ground,
  Slot, Settings, Gallery, Review, Contact, BlockedCustomer, FinanceEntry,
  FinanceCategory, AuditLog, BookingRequest, Payment); the authoritative list
  MUST be confirmed against the actual current model definitions during
  planning, since it may be incomplete.
