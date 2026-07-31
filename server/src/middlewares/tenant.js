import Tenant from '../models/master/Tenant.js';
import { getTenantConnection } from '../config/sequelize.js';
import { createModels } from '../models/model-factory.js';

// ── Tenant Resolution Middleware ──
// Extracts the subdomain from the request hostname, looks up the tenant in the
// master database, and attaches a tenant-scoped Sequelize connection + models
// to the request object.
//
// After this middleware runs, controllers can use:
//   req.tenant     → { id, slug, businessName, dbName, ... }
//   req.models     → { Admin, Booking, Slot, Settings, ... }
//   req.tenantDb   → Sequelize instance for this tenant's database

const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract tenant slug from hostname.
 * Supports: subdomain.domain.com and localhost:<port> for development.
 */
function extractSlug(hostname) {
  // Remove port if present
  const host = hostname.split(':')[0];

  // Development: use query param or header fallback
  // In dev, there's no real subdomain on localhost
  if (host === 'localhost' || host === '127.0.0.1') {
    return null; // Will be extracted from header or query in dev
  }

  // Production: extract subdomain
  // e.g., "apexarena.daruntech.com" → "apexarena"
  const parts = host.split('.');
  if (parts.length >= 3) {
    return parts[0]; // First part is the subdomain
  }

  return null;
}

/**
 * Look up tenant by slug with caching.
 */
async function resolveTenant(slug) {
  const cached = tenantCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.tenant;
  }

  const tenant = await Tenant.findOne({ where: { slug, isActive: true } });
  if (tenant) {
    tenantCache.set(slug, { tenant: tenant.toJSON(), timestamp: Date.now() });
  }
  return tenant ? tenant.toJSON() : null;
}

/**
 * Clear tenant cache (call when tenant is updated/deleted).
 */
export function clearTenantCache(slug) {
  if (slug) {
    tenantCache.delete(slug);
  } else {
    tenantCache.clear();
  }
}

/**
 * Tenant middleware — attach tenant context to every request.
 */
export const tenantMiddleware = async (req, res, next) => {
  try {
    // Extract slug from subdomain, header (dev), or query param (dev)
    let slug = extractSlug(req.hostname);

    // Development fallback: use X-Tenant-Slug header or ?tenant= query param
    if (!slug && process.env.NODE_ENV !== 'production') {
      slug = req.headers['x-tenant-slug'] || req.query.tenant;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG TENANT RESOLUTION] URL: ${req.originalUrl} | Method: ${req.method} | Resolved Slug: ${slug} | X-Tenant-Slug Header: ${req.headers['x-tenant-slug']} | Query Tenant: ${req.query.tenant}`);
    }

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Tenant not specified. Use a subdomain or X-Tenant-Slug header.',
      });
    }

    // Look up tenant
    const tenant = await resolveTenant(slug);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: `Tenant "${slug}" not found or inactive.`,
      });
    }

    // Check subscription expiration date
    if (tenant.subscriptionExpiresAt && new Date(tenant.subscriptionExpiresAt) < new Date()) {
      return res.status(403).json({
        success: false,
        message: `Tenant "${tenant.businessName}" subscription has expired. Please contact support.`,
        isExpired: true,
      });
    }

    // Get or create Sequelize connection for this tenant's database
    const tenantDb = getTenantConnection(tenant.dbName);

    // Create models bound to this connection
    const models = createModels(tenantDb);

    // Ensure tables exist (only syncs once per connection due to model caching)
    // In production, this should be done during tenant provisioning, not per-request
    if (!tenantDb._synced) {
      await models.syncDatabase();
      
      // Raw SQL fallback column migration to bypass Sequelize MySQL alter bugs
      try {
        await tenantDb.query("ALTER TABLE `booking_requests` ADD `isSuspicious` TINYINT(1) NOT NULL DEFAULT 0");
      } catch (err) {
        // Safe to ignore if column already exists
      }
      try {
        await tenantDb.query("ALTER TABLE `booking_requests` ADD `suspiciousReason` VARCHAR(255) NULL");
      } catch (err) {
        // Safe to ignore if column already exists
      }

      tenantDb._synced = true;
    }

    // Attach to request
    req.tenant = tenant;
    req.tenantDb = tenantDb;
    req.models = models;

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    next(error);
  }
};

export default tenantMiddleware;
