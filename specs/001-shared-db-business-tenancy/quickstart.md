# Quickstart: Validating Shared-Database, JWT-Derived Business Tenancy

## Prerequisites

- A local MySQL instance with two pre-migration tenant databases restored
  (or freshly seeded) for a realistic test: `db_dbox`, `db_cagindoor`.
- `server/.env` pointed at that MySQL instance, with a new
  `DB_NAME` (the single shared database this feature introduces) and the
  legacy `MASTER_DB_NAME`/per-tenant vars still present until Phase 5 removes
  them (see `plan.md`).
- `npm install` in `server/` (adds `jest`, `supertest` per `research.md`
  Decision 5).

## Run the migration locally

```sh
cd server
npm run migrate         # runs migrations/001..00N in order (added this feature)
npm run migrate:backfill  # data-backfill script: copies db_dbox/db_cagindoor rows into the shared DB with businessId populated
```

Expected outcome: the shared database now contains one `Business` row per
former tenant database, and every business-owned table's row count equals
the sum of the corresponding table's row count across all former per-tenant
databases (Success Criteria SC-001).

## Validate isolation end-to-end

```sh
cd server
npm test                # runs tests/tenant-isolation.test.js via Jest + Supertest
```

Expected outcome: all tests pass, specifically proving (per spec User
Stories 1 and 4):

- Admin A's bookings list never contains Business B's rows.
- A write with a client-supplied `businessId` field is rejected 400.
- A `Booking` write referencing another business's `groundId` is rejected 400.
- A manager scoped to Business A cannot act on Business B's data even with a
  valid token.

## Validate provisioning end-to-end

```sh
cd server
npm run dev
```

Then, as Super Admin, call `POST /api/master/tenants` with a new slug and
confirm (per spec User Story 2 / SC-003):

1. The response succeeds and returns the new business.
2. `SHOW DATABASES;` against the MySQL instance shows no new database was
   created.
3. The new business's admin can log in immediately (`POST /api/v1/auth/login`
   with an `Authorization`-free request, then use the returned JWT) and
   sees an empty dashboard, not another tenant's data or an error.

## Validate the public storefront still resolves by hostname

```sh
curl -H "X-Tenant-Slug: dbox" http://localhost:5000/api/v1/settings/public
curl -H "X-Tenant-Slug: cagindoor" http://localhost:5000/api/v1/settings/public
```

Expected: each returns its own business's branding only, and neither header
has any effect when sent alongside a valid `Authorization` bearer token on
an authenticated route (per contracts/README.md).
