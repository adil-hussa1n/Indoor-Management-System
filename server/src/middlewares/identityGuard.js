// ── Identifier Guard Middleware ──
// Constitution Principle II: businessId/tenantId/adminId/userId MUST NEVER
// be accepted from a client-supplied request body on any write endpoint.
// Applied globally to every POST/PUT/PATCH under /api/v1 (see app.js),
// not re-implemented per controller.

const FORBIDDEN_KEYS = ['businessId', 'tenantId', 'adminId', 'userId'];
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

export const identityGuard = (req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) return next();
  if (!req.body || typeof req.body !== 'object') return next();

  const offending = FORBIDDEN_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(req.body, key));
  if (offending.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Client-supplied identifier field(s) not allowed: ${offending.join(', ')}`,
    });
  }

  next();
};

export default identityGuard;
