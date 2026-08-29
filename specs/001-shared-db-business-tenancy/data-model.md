# Data Model: Shared-Database, JWT-Derived Business Tenancy

## New entity: `Business`

Replaces the master-DB `Tenant` model (`server/src/models/master/Tenant.js`)
as an ordinary table in the single shared database. Carries forward every
field from `Tenant` except `dbName` (meaningless once there is only one
database) and any per-tenant-DB bookkeeping (`slug`'s validation stays —
it's still needed for public-storefront hostname resolution, Principle V).

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK, autoincrement | New businesses' `businessId` FK target |
| `slug` | STRING(63), unique | Subdomain slug — public-storefront hostname resolution only (Principle V) |
| `businessName` | STRING, required | |
| `adminEmail` | STRING, nullable | |
| `adminPhone` | STRING, nullable | |
| `isActive` | BOOLEAN, default true | Super Admin suspend/reactivate |
| `plan` | ENUM(free, basic, pro) | |
| `subscriptionExpiresAt` | DATE, nullable | Suspension logic moves from `tenantMiddleware` to the new JWT-derived business-scope middleware |
| `customDomain` | STRING, nullable, unique | |
| `smsCredentials` | JSON, nullable | |
| `subscriptionPrice`, `subscriptionPlan`, `totalRevenueCollected`, `paymentStatus`, `lastPaymentDate` | as in `Tenant` | |
| `allowPaymentGateway` | BOOLEAN, default true | |

`SuperAdmin` and `SubscriptionHistory` (`server/src/models/master/`) remain
platform-wide, cross-business models — they move into the same shared
database as ordinary (non-`businessId`-scoped) tables, since Super Admin
identity and subscription history are inherently cross-tenant.

## Modified entities: add `businessId` to every business-owned model

All 17 models currently defined in `server/src/models/model-factory.js`
except `OTP` and `SlotLock`* gain a required `businessId INTEGER NOT NULL`
column with an FK to `Business.id`, added via the phased migration
(additive/nullable first, see `plan.md`):

`Admin`, `Booking`, `BookingStatusHistory`, `BookingRequest`, `Ground`,
`Slot`, `User`, `Review`, `Gallery`, `Contact`, `Settings`, `AuditLog`,
`BlockedCustomer`, `FinanceCategory`, `FinanceEntry`.

`SlotLock` and `OTP` derive their business scope transitively (via
`groundId`/`phone` lookups already scoped by the caller) but MUST also
carry `businessId` directly rather than relying on transitive scoping,
per constitution Principle I.4 ("every repository/controller query MUST
filter by `req.businessId`") — indirect scoping through a joined table is
not sufficient, since `SlotLock`/`OTP` rows are read directly by phone/date
without always joining through `Ground`.

*(all 17 models get `businessId`; the note above only flags `SlotLock`/`OTP`
as easy to overlook because their current repository methods don't join
through an obviously tenant-scoped parent.)*

### Uniqueness constraints that must become composite (`businessId`, ...)

These currently rely on being the only tenant in their table (per-tenant DB
gave this "for free"); in a shared DB they become genuine cross-tenant
collisions unless recomposed:

| Model | Current constraint | New constraint |
|---|---|---|
| `Admin` | `username` unique | unique (`businessId`, `username`) |
| `User` | `phone` unique | unique (`businessId`, `phone`) — the same customer phone number may legitimately book at two different venues |
| `BlockedCustomer` | `phone` unique | unique (`businessId`, `phone`) |
| `Business` (new) | — | `slug` stays globally unique (subdomains are global) |

### Cross-business FK integrity targets (Principle III)

Foreign keys between business-owned models that need write-time
same-`businessId` validation:

- `Booking.groundId` → `Ground.id`
- `Booking.userId` → `User.id`
- `Slot.groundId` → `Ground.id`
- `SlotLock.groundId` → `Ground.id`
- `BookingRequest.bookingId` → `Booking.id`, `BookingRequest.userId` → `User.id`
- `FinanceEntry.categoryId` → `FinanceCategory.id`
- `FinanceEntry.groundId` → `Ground.id`
- `BookingStatusHistory.bookingId` → `Booking.id`

## JWT claim shape

| Path | Before | After |
|---|---|---|
| Admin/manager login | `{ id, tenant: <slug>, type: 'admin' }` | `{ id, businessId, type: 'admin' }` |
| Customer OTP login | `{ id, tenant: <slug>, type: 'user' }` | `{ id, businessId, type: 'user' }` |
| Super Admin login | unrelated to business scope | unchanged |

`protect` middleware's mismatch check changes from
`decoded.tenant === req.tenant.slug` to establishing `req.businessId`
directly from `decoded.businessId` (there is no longer a separately-resolved
`req.tenant` to compare against on authenticated routes — Principle V limits
hostname resolution to public/unauthenticated routes only).

## Request-context shape (replaces `req.tenant` / `req.tenantDb` / `req.models`)

| Old | New |
|---|---|
| `req.tenant` (full Tenant row, from hostname lookup, on every request) | `req.businessId` (integer, from JWT, on authenticated requests only) |
| `req.tenantDb` (per-tenant Sequelize instance) | removed — one shared `sequelize` instance imported directly where needed |
| `req.models` (per-tenant model set) | removed — models imported directly from the single `model-factory.js` output (now defined once at boot) |
| `req.repos` (built from `req.models`) | `req.repos` (built by `withBusinessScope(repositories, req.businessId)` — same shape/method names, transparently scoped) |
