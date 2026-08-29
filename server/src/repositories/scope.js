// ── Business-Scoping Repository Wrapper ──
// Per constitution Principle I.4 and specs/001-shared-db-business-tenancy/
// research.md Decision 2: every repository method in repository-factory.js
// already threads an explicit `where` (read) or `data` (write) object as
// its leading argument(s). This wrapper is the single choke point that
// merges `{ businessId }` into every one of those calls, so every query
// against the shared database is scoped without having to hand-edit every
// controller call site.
//
// Two mechanisms, layered (constitution Principle III.6 — defense in depth,
// no single layer is trusted alone):
//   1. Pre-filter: for read methods whose first argument is a `where`
//      object (findAll/findAndCountAll/count/sum/...), merge
//      { businessId } into it before the query runs.
//   2. Post-check: for read methods that take a scalar id/uuid/phone
//      (findById/findByPk/findByUuid/findByPhone/...) where a WHERE-clause
//      merge isn't possible, fetch as normal, then verify the returned
//      row's businessId matches — return null instead of leaking a
//      cross-business row. Also applied to array results as a redundant
//      second check even when pre-filtering was possible.
//
// create() calls get { businessId } merged into their data object.
// update()/delete() operate on a row already obtained via a scoped find —
// they don't take a `where` object in this codebase's repository-factory,
// so they are left to the caller's prior scoped lookup + the DB-level FK
// constraint (plan.md Phase 4/T018) as the safety net.

const READ_PREFIXES = ['find', 'count', 'sum', 'get', 'isBlocked'];
const CREATE_PREFIXES = ['create'];

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function mergeBusinessId(arg, businessId) {
  return isPlainObject(arg) ? { ...arg, businessId } : arg;
}

function belongsToBusiness(row, businessId) {
  if (row == null) return true;
  const rowBusinessId = typeof row.get === 'function' ? row.get('businessId') : row.businessId;
  // A row with no businessId column (count/sum numeric results, or a model
  // genuinely not yet migrated) is passed through — only enforce the check
  // when the field is actually present on the returned value.
  if (rowBusinessId === undefined) return true;
  return rowBusinessId === businessId;
}

function enforceOwnership(result, businessId) {
  if (Array.isArray(result)) {
    return result.filter((row) => belongsToBusiness(row, businessId));
  }
  if (result && typeof result === 'object' && 'count' in result && 'rows' in result) {
    // findAndCountAll shape
    const rows = result.rows.filter((row) => belongsToBusiness(row, businessId));
    return { ...result, rows, count: rows.length === result.rows.length ? result.count : rows.length };
  }
  if (result && typeof result === 'object' && !belongsToBusiness(result, businessId)) {
    return null;
  }
  return result;
}

function scopeMethod(methodName, fn, businessId) {
  const isRead = READ_PREFIXES.some((p) => methodName.startsWith(p));
  const isCreate = CREATE_PREFIXES.some((p) => methodName.startsWith(p));

  if (isCreate) {
    return (...args) => {
      if (args.length === 0) return fn({ businessId });
      const [first, ...rest] = args;
      return fn(mergeBusinessId(first, businessId), ...rest);
    };
  }

  if (isRead) {
    return async (...args) => {
      const scopedArgs = args.length === 0
        ? [{ businessId }]
        : [mergeBusinessId(args[0], businessId), ...args.slice(1)];
      const result = await fn(...scopedArgs);
      return enforceOwnership(result, businessId);
    };
  }

  // update/delete/etc. — pass through unchanged; the row was already
  // obtained via a scoped find/findById call by the caller.
  return fn;
}

/**
 * Wrap every repository returned by createRepositories(models) so every
 * find/count/sum/get/create method call is scoped to `businessId`.
 * @param {Object} repositories - output of createRepositories(models)
 * @param {number} businessId - req.businessId, from the JWT
 * @returns {Object} the same repository shape, transparently scoped
 */
export function withBusinessScope(repositories, businessId) {
  if (!businessId) {
    throw new Error('withBusinessScope requires a businessId — did businessContext middleware run first?');
  }

  const scoped = {};
  for (const [repoName, repo] of Object.entries(repositories)) {
    const scopedRepo = {};
    for (const [methodName, fn] of Object.entries(repo)) {
      scopedRepo[methodName] = typeof fn === 'function'
        ? scopeMethod(methodName, fn, businessId)
        : fn;
    }
    scoped[repoName] = scopedRepo;
  }
  return scoped;
}

export default withBusinessScope;
