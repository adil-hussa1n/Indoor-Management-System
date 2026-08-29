# Contracts: Shared-Database, JWT-Derived Business Tenancy

This feature does not add or remove public REST endpoints, and the response
envelope (`{ success, message, data }`) is explicitly unchanged (spec
Assumptions). The contracts that change are internal: the JWT claim shape
and the request-scoping guarantees every existing endpoint now provides.

## JWT claim contract

**Before**: `{ id, tenant: <slug>, type }`
**After**: `{ id, businessId, type }`

Any client (the `client/` React app, or any other JWT holder) that inspected
or forwarded the `tenant` claim must be updated to use `businessId`
instead. Tokens issued before cutover (carrying `tenant`, not `businessId`)
MUST be rejected post-cutover (spec FR-013) — `protect` middleware must
treat a token with no `businessId` claim as invalid, not fall back to a
default/zero business.

## Tenant-resolution header/param contract (removed for authenticated routes)

**Before**: `X-Tenant-Slug` header or `?tenant=` query param selected the
active tenant for every `/api/v1/*` request (dev fallback when no
subdomain present).
**After**: authenticated requests carry no tenant-selection header/param at
all — business scope comes only from the `Authorization: Bearer <jwt>`
token (Principle I.3). `X-Tenant-Slug`/`?tenant=` continue to exist **only**
on the public, unauthenticated storefront routes (Principle V) to resolve
branding by hostname in local dev where there's no real subdomain — but
carry no authority over any authenticated request's scope.

## Identifier-guard contract (new)

Every `POST`/`PUT`/`PATCH` request body is now validated to reject
`businessId`, `tenantId`, `adminId`, `userId` if present, with:

```json
{ "success": false, "message": "Client-supplied identifier field(s) not allowed: businessId" }
```

HTTP 400. This applies uniformly across every existing write route; no
existing legitimate client request should ever have been sending these
fields, so this is additive protection, not a breaking contract change for
correctly-behaved clients.

## Cross-business FK rejection contract (new)

A write whose FK (e.g. `groundId`, `categoryId`) resolves to a row owned by
a different business now returns HTTP 400 instead of either succeeding
(today's latent risk, currently only prevented by tenant DB isolation) or a
generic 500/404. Message format:

```json
{ "success": false, "message": "<field> does not belong to your business" }
```

## Super Admin tenant-provisioning contract

`POST /api/master/tenants` request/response shape is unchanged from the
caller's perspective (still takes `slug`, `businessName`,
`adminUsername`/`adminPassword`, etc., still returns the created tenant).
Internally it no longer creates a database — see `plan.md` Phase 5 and
`data-model.md`'s `Business` entity.
