// ── Auth Cookie Helper ──
// Matches the business_backend/restaurant_backend convention: the JWT is
// carried in an httpOnly cookie, never returned in a JSON response body or
// stored in client-readable JS state. See businessContext.js and
// middlewares/auth.js's protectSuperAdmin for the read side (cookie first,
// Authorization header fallback for any non-browser client).
//
// Distinct cookie names per token type (rather than one shared `token`
// cookie) — admin, customer, and super-admin sessions can coexist in the
// same browser on the same domain (e.g. a tenant admin panel and its
// public storefront under one subdomain), mirroring the distinct
// localStorage keys (`adminToken_*`, `userToken_*`, `superAdminToken`)
// this replaces.
export const COOKIE_NAMES = {
  admin: 'admin_token',
  user: 'user_token',
  superadmin: 'superadmin_token',
};

const isProd = () => process.env.NODE_ENV === 'production';

const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: isProd() ? 'none' : 'lax',
  path: '/',
  ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
});

/**
 * Set the httpOnly auth cookie carrying a signed JWT.
 * @param {import('express').Response} res
 * @param {'admin'|'user'|'superadmin'} type
 * @param {string} token
 * @param {number} maxAgeMs
 */
export function setAuthCookie(res, type, token, maxAgeMs) {
  res.cookie(COOKIE_NAMES[type], token, cookieOptions(maxAgeMs));
}

/**
 * Clear an auth cookie on logout.
 * @param {import('express').Response} res
 * @param {'admin'|'user'|'superadmin'} type
 */
export function clearAuthCookie(res, type) {
  res.clearCookie(COOKIE_NAMES[type], cookieOptions());
}

/**
 * Extract the raw JWT from the request for a given token type: cookie
 * first (browser clients), falling back to `Authorization: Bearer <token>`
 * for any non-browser client during the migration window.
 * @param {import('express').Request} req
 * @param {'admin'|'user'|'superadmin'|Array<'admin'|'user'|'superadmin'>} [types]
 *   - a single type, an array of types to check in order (first match
 *     wins), or omit to check every cookie name.
 * @returns {string|null}
 */
export function extractToken(req, types) {
  const typeList = Array.isArray(types) ? types : types ? [types] : Object.keys(COOKIE_NAMES);
  if (req.cookies) {
    for (const t of typeList) {
      if (req.cookies[COOKIE_NAMES[t]]) return req.cookies[COOKIE_NAMES[t]];
    }
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/**
 * Parse a jsonwebtoken-style `expiresIn` string (e.g. '7d', '24h', '30d')
 * into milliseconds, for use as a cookie's `maxAge`. Falls back to
 * `fallbackMs` if the string doesn't match the expected `<number><unit>`
 * shape jsonwebtoken accepts.
 * @param {string} expiresIn
 * @param {number} fallbackMs
 * @returns {number}
 */
export function expiresInToMs(expiresIn, fallbackMs) {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(String(expiresIn || '').trim());
  if (!match) return fallbackMs;
  return Number(match[1]) * UNIT_MS[match[2]];
}
