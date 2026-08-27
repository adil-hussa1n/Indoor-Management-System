import jwt from 'jsonwebtoken';
import Business from '../models/Business.js';

// ── Business Context Middleware ──
// Replaces server/src/middlewares/tenant.js's subdomain/X-Tenant-Slug
// tenant-resolution-by-hostname approach for the request-scoping role.
// Per constitution Principle I.3, this is the ONLY place `req.businessId`
// is established for the rest of the request pipeline.
//
// Two resolution paths, by design (documented departure worth noting: a
// pure "JWT only, ever" reading of Principle I.3 runs into a chicken-and-
// egg problem at login — there is no JWT yet to derive business scope
// from). The resolution:
//   1. A valid `Authorization: Bearer <jwt>` is present → businessId comes
//      EXCLUSIVELY from the token's `businessId` claim. Hostname/header/
//      query are never consulted once a token is present — this is the
//      authenticated path Principle I.3 governs, and it is what every
//      route reachable after login uses.
//   2. No token present (pre-auth: login endpoints, and public storefront
//      routes under Principle V) → businessId is resolved from the request
//      hostname/`X-Tenant-Slug` header/`?tenant=` query param, exactly as
//      the public storefront already does. This is the only place hostname
//      resolution is still permitted, and it never applies once a token is
//      supplied.

const extractSlug = (req) => {
  const host = (req.hostname || '').split(':')[0];
  let slug = null;

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    const parts = host.split('.');
    if (parts.length >= 3) slug = parts[0];
  }

  if (!slug && process.env.NODE_ENV !== 'production') {
    slug = req.headers['x-tenant-slug'] || req.query.tenant;
  }

  if (slug && typeof slug === 'string') {
    slug = slug.split('/')[0].split('?')[0].trim();
  }
  return slug || null;
};

const checkSubscriptionGrace = (business) => {
  if (!business.subscriptionExpiresAt) return true;
  const now = new Date();
  const expiry = new Date(business.subscriptionExpiresAt);
  const graceCutoff = new Date(expiry.getTime() + 7 * 24 * 60 * 60 * 1000);
  return now <= graceCutoff;
};

export const businessContext = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }

      // Tokens issued under the pre-migration scheme carried `tenant: <slug>`
      // and no `businessId` claim — reject them outright (spec FR-013),
      // forcing a fresh login rather than silently trusting a stale shape.
      if (!decoded.businessId) {
        return res.status(401).json({
          success: false,
          message: 'Session is from a previous version of this system. Please log in again.',
        });
      }

      const business = await Business.findByPk(decoded.businessId);
      if (!business || !business.isActive) {
        return res.status(401).json({ success: false, message: 'Business not found or has been deactivated' });
      }
      if (!checkSubscriptionGrace(business)) {
        return res.status(403).json({
          success: false,
          message: `"${business.businessName}" subscription expired over 7 days ago and has been suspended. Please contact support to renew immediately.`,
          isExpired: true,
          isSuspended: true,
        });
      }

      req.businessId = business.id;
      req.business = business;
      req.jwtDecoded = decoded; // consumed by auth.js's `protect` for admin/user identity resolution
      return next();
    }

    // Pre-auth path: login endpoints and public storefront routes only.
    const slug = extractSlug(req);
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Business not specified. Use a subdomain or X-Tenant-Slug header.',
      });
    }

    const business = await Business.findOne({ where: { slug, isActive: true } });
    if (!business) {
      return res.status(404).json({ success: false, message: `Business "${slug}" not found or inactive.` });
    }
    if (!checkSubscriptionGrace(business)) {
      return res.status(403).json({
        success: false,
        message: `"${business.businessName}" subscription expired over 7 days ago and has been suspended. Please contact support to renew immediately.`,
        isExpired: true,
        isSuspended: true,
      });
    }

    req.businessId = business.id;
    req.business = business;
    next();
  } catch (error) {
    console.error('businessContext middleware error:', error);
    next(error);
  }
};

export default businessContext;
