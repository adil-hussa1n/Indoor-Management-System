// ── Shared Pagination Helper ──
// Constitution Principle VII: every list endpoint MUST paginate server-side
// with a consistent default (20) and maximum (100) page size, matching the
// workspace-wide standard already binding on business_backend and
// restaurant_backend's StandardResultsSetPagination.

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Parse `page`/`limit` query params into a bounded { page, limit, offset }.
 * @param {Object} query - req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let limit = parseInt(query.limit ?? query.page_size ?? query.per_page, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_PAGE_SIZE;
  if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Build the standard pagination response block.
 * @param {number} total
 * @param {{ page: number, limit: number }} pagination
 */
export function paginationMeta(total, { page, limit }) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export default parsePagination;
