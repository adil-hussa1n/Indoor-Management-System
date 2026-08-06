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

let masterColumnsSynced = false;

async function ensureMasterColumns() {
  if (masterColumnsSynced) return;
  const cols = [
    "ALTER TABLE `tenants` ADD COLUMN `subscriptionPrice` DECIMAL(10,2) DEFAULT 0.00",
    "ALTER TABLE `tenants` ADD COLUMN `subscriptionPlan` VARCHAR(255) DEFAULT '1_month'",
    "ALTER TABLE `tenants` ADD COLUMN `totalRevenueCollected` DECIMAL(10,2) DEFAULT 0.00",
    "ALTER TABLE `tenants` ADD COLUMN `paymentStatus` VARCHAR(255) DEFAULT 'paid'",
    "ALTER TABLE `tenants` ADD COLUMN `lastPaymentDate` DATETIME NULL",
  ];
  for (const q of cols) {
    try {
      await masterSequelize.query(q);
    } catch (e) {}
  }
  masterColumnsSynced = true;
}

/**
 * Look up tenant by slug with caching.
 */
async function resolveTenant(slug) {
  const cached = tenantCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.tenant;
  }

  await ensureMasterColumns();

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

    if (slug && typeof slug === 'string') {
      slug = slug.split('/')[0].split('?')[0].trim();
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

    // Check subscription expiration date with 7-Day Grace Period
    if (tenant.subscriptionExpiresAt) {
      const now = new Date();
      const expiry = new Date(tenant.subscriptionExpiresAt);
      const graceCutoff = new Date(expiry.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 Days Grace Period

      // Hard suspension occurs ONLY if 7 full days pass after subscriptionExpiresAt
      if (now > graceCutoff) {
        return res.status(403).json({
          success: false,
          message: `Tenant "${tenant.businessName}" subscription expired over 7 days ago and has been suspended. Please contact support to renew immediately.`,
          isExpired: true,
          isSuspended: true,
        });
      }
    }

    // Get or create Sequelize connection for this tenant's database
    const tenantDb = getTenantConnection(tenant.dbName);

    // Create models bound to this connection
    const models = createModels(tenantDb);

    // Ensure tables exist (only syncs once per connection due to model caching)
    // In production, this should be done during tenant provisioning, not per-request
    if (!tenantDb._synced) {
      
      // 1. Pre-sync raw SQL column additions to bypass index generation failures on existing tables
      try {
        await tenantDb.query("ALTER TABLE `booking_requests` ADD COLUMN `isSuspicious` TINYINT(1) NOT NULL DEFAULT 0");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `booking_requests` ADD COLUMN `suspiciousReason` VARCHAR(255) NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `settings` ADD COLUMN `discounts` JSON NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `settings` ADD COLUMN `maintenanceMode` JSON NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `slots` ADD COLUMN `groundId` INT NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `bookings` ADD COLUMN `groundId` INT NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `slot_locks` ADD COLUMN `groundId` INT NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `grounds` ADD COLUMN `order` INT NOT NULL DEFAULT 0");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `audit_logs` ADD COLUMN `adminUsername` VARCHAR(255) NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `audit_logs` ADD COLUMN `category` VARCHAR(255) NULL DEFAULT 'general'");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `audit_logs` ADD COLUMN `description` TEXT NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `settings` ADD COLUMN `paymentConfig` JSON NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `bookings` ADD COLUMN `paymentStatus` VARCHAR(255) NULL DEFAULT 'unpaid'");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `bookings` ADD COLUMN `paidAmount` DECIMAL(10,2) NULL DEFAULT 0.00");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `bookings` ADD COLUMN `dueAmount` DECIMAL(10,2) NULL DEFAULT 0.00");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `bookings` ADD COLUMN `paymentGateway` VARCHAR(255) NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `bookings` ADD COLUMN `transactionId` VARCHAR(255) NULL");
      } catch (err) {}
      try {
        await tenantDb.query("ALTER TABLE `bookings` ADD COLUMN `paymentDetails` JSON NULL");
      } catch (err) {}

      // 2. Perform Sequelize sync
      await models.syncDatabase();

      // 3. Post-sync raw SQL index additions
      try {
        await tenantDb.query("CREATE INDEX `idx_slots_groundId` ON `slots` (`groundId`)");
      } catch (err) {}
      try {
        await tenantDb.query("CREATE INDEX `idx_bookings_groundId` ON `bookings` (`groundId`)");
      } catch (err) {}
      try {
        await tenantDb.query("CREATE INDEX `idx_slot_locks_groundId` ON `slot_locks` (`groundId`)");
      } catch (err) {}

      // Create a unique composite index for slots
      try {
        await tenantDb.query("CREATE UNIQUE INDEX `idx_slots_unique_time_ground` ON `slots` (`startTime`, `endTime`, `dayOfWeek`, `specificDate`, `groundId`)");
      } catch (err) {}

      // Provision default Main Arena (ID 1)
      try {
        await tenantDb.query(
          "INSERT IGNORE INTO `grounds` (`id`, `name`, `sport`, `isActive`, `createdAt`, `updatedAt`) VALUES (1, 'Main Arena', 'Football', 1, NOW(), NOW())"
        );
      } catch (err) {}

      // Backfill groundId to point to default ground 1
      try {
        await tenantDb.query("UPDATE `slots` SET `groundId` = 1 WHERE `groundId` IS NULL");
      } catch (err) {}
      try {
        await tenantDb.query("UPDATE `bookings` SET `groundId` = 1 WHERE `groundId` IS NULL");
      } catch (err) {}
      try {
        await tenantDb.query("UPDATE `slot_locks` SET `groundId` = 1 WHERE `groundId` IS NULL");
      } catch (err) {}

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
