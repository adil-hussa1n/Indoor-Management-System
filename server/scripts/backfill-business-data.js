import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { sequelize as sharedDb } from '../src/config/db.js';
import Business from '../src/models/Business.js';
import { createModels } from '../src/models/model-factory.js';

// ── Data Backfill: Per-Tenant Databases → Shared Database ──
// Rollout Phase 2 (plan.md). Reads every tenant registered in the OLD
// master database and every row in that tenant's OLD per-tenant database,
// and copies it into the single shared database (server/src/config/db.js),
// setting `businessId` on every row.
//
// Primary keys are remapped with a per-tenant, collision-free offset
// (TENANT_ID_BLOCK * tenant index) applied uniformly to every numeric
// id/FK column in every table for that tenant — since a tenant's own
// per-tenant database had internally-consistent auto-increment ids, adding
// the same offset to a row's own id AND to every FK value that pointed at
// a same-tenant row preserves every relationship correctly (see
// research.md / plan.md for why this is safe).
//
// Usage:
//   node scripts/backfill-business-data.js --dry-run     (report only, no writes)
//   node scripts/backfill-business-data.js                (apply)
//   OLD_MASTER_DB_NAME=indoor_master_db node scripts/backfill-business-data.js
//
// Requires the OLD per-tenant databases and the OLD master database to
// still exist and be reachable via DB_HOST/DB_USER/DB_PASSWORD/DB_PORT —
// run this BEFORE migrations/002-business-id-not-null-and-fk.js, and
// BEFORE any deploy that removes the old per-tenant databases.

const DRY_RUN = process.argv.includes('--dry-run');
const TENANT_ID_BLOCK = 10_000_000; // must exceed the largest plausible per-tenant row count for any single table

const oldConnectionOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  logging: false,
};

const openOldDb = (dbName) =>
  new Sequelize(dbName, process.env.DB_USER || 'root', process.env.DB_PASSWORD || '', oldConnectionOptions);

// Tables to copy, with the columns (beyond id/timestamps) that are
// remappable ids referencing another row *within the same tenant*.
// Order doesn't matter for FK-constraint reasons (no FK constraints exist
// on the shared DB yet at this rollout phase — migration 002 adds them
// only after this backfill is verified), but is kept dependency-ordered
// for readability.
const TABLE_PLAN = [
  { table: 'admins', model: 'Admin', fkColumns: [] },
  { table: 'grounds', model: 'Ground', fkColumns: [] },
  { table: 'users', model: 'User', fkColumns: [] },
  { table: 'finance_categories', model: 'FinanceCategory', fkColumns: [] },
  { table: 'slots', model: 'Slot', fkColumns: ['groundId'] },
  { table: 'slot_locks', model: 'SlotLock', fkColumns: ['groundId'] },
  { table: 'bookings', model: 'Booking', fkColumns: ['groundId', 'userId'] },
  { table: 'booking_status_history', model: 'BookingStatusHistory', fkColumns: ['bookingId'] },
  { table: 'booking_requests', model: 'BookingRequest', fkColumns: ['bookingId', 'userId'] },
  { table: 'finance_entries', model: 'FinanceEntry', fkColumns: ['categoryId', 'groundId'] },
  { table: 'otps', model: 'OTP', fkColumns: [] },
  { table: 'reviews', model: 'Review', fkColumns: [] },
  { table: 'gallery', model: 'Gallery', fkColumns: [] },
  { table: 'contacts', model: 'Contact', fkColumns: [] },
  { table: 'settings', model: 'Settings', fkColumns: [] },
  { table: 'audit_logs', model: 'AuditLog', fkColumns: ['userId'] },
  { table: 'blocked_customers', model: 'BlockedCustomer', fkColumns: [] },
];

const remapRow = (row, offset, fkColumns) => {
  const remapped = { ...row, id: row.id + offset };
  for (const col of fkColumns) {
    if (remapped[col] !== null && remapped[col] !== undefined) {
      remapped[col] = remapped[col] + offset;
    }
  }
  return remapped;
};

async function backfillTenant(tenant, tenantIndex, sharedModels) {
  const offset = tenantIndex * TENANT_ID_BLOCK;
  console.log(`\n--- Backfilling tenant "${tenant.slug}" (${tenant.dbName}), id offset +${offset} ---`);

  let business = await Business.findOne({ where: { slug: tenant.slug } });
  if (!business) {
    if (DRY_RUN) {
      console.log(`  [dry-run] would create Business row for "${tenant.slug}"`);
    } else {
      business = await Business.create({
        slug: tenant.slug,
        businessName: tenant.businessName,
        adminEmail: tenant.adminEmail,
        adminPhone: tenant.adminPhone,
        isActive: tenant.isActive,
        plan: tenant.plan,
        subscriptionExpiresAt: tenant.subscriptionExpiresAt,
        customDomain: tenant.customDomain,
        smsCredentials: tenant.smsCredentials,
        subscriptionPrice: tenant.subscriptionPrice,
        subscriptionPlan: tenant.subscriptionPlan,
        totalRevenueCollected: tenant.totalRevenueCollected,
        paymentStatus: tenant.paymentStatus,
        lastPaymentDate: tenant.lastPaymentDate,
        allowPaymentGateway: tenant.allowPaymentGateway,
      });
    }
  }
  const businessId = business ? business.id : '(pending)';

  const oldDb = openOldDb(tenant.dbName);
  await oldDb.authenticate();

  const summary = [];
  for (const { table, model, fkColumns } of TABLE_PLAN) {
    const [rows] = await oldDb.query(`SELECT * FROM \`${table}\``);
    summary.push({ table, count: rows.length });

    if (DRY_RUN) {
      console.log(`  [dry-run] ${table}: ${rows.length} row(s) would be copied`);
      continue;
    }
    if (rows.length === 0) continue;

    const targetModel = sharedModels[model];
    const remapped = rows.map((row) => ({
      ...remapRow(row, offset, fkColumns),
      businessId,
    }));

    // bulkCreate with individualHooks:false and ignoreDuplicates guards
    // against a re-run after a partial failure being destructive.
    await targetModel.bulkCreate(remapped, { ignoreDuplicates: true, validate: false });
    console.log(`  ✅ ${table}: ${rows.length} row(s) copied (offset +${offset})`);
  }

  await oldDb.close();
  return summary;
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN — no writes will be made ===' : '=== APPLYING BACKFILL ===');

  const masterDbName = process.env.OLD_MASTER_DB_NAME || process.env.MASTER_DB_NAME || 'indoor_master_db';
  const masterDb = openOldDb(masterDbName);
  await masterDb.authenticate();
  const [tenants] = await masterDb.query('SELECT * FROM `tenants` ORDER BY id ASC');
  await masterDb.close();

  if (tenants.length === 0) {
    console.log('No tenants found in the old master database — nothing to backfill.');
    return;
  }

  await sharedDb.authenticate();
  const sharedModels = createModels(sharedDb);

  const allSummaries = [];
  for (let i = 0; i < tenants.length; i++) {
    const summary = await backfillTenant(tenants[i], i, sharedModels);
    allSummaries.push({ tenant: tenants[i].slug, summary });
  }

  console.log('\n=== BACKFILL SUMMARY ===');
  for (const { tenant, summary } of allSummaries) {
    console.log(`${tenant}: ${summary.map((s) => `${s.table}=${s.count}`).join(', ')}`);
  }
  console.log(DRY_RUN
    ? '\nDry run complete. Re-run without --dry-run to apply, then run scripts/verify-backfill.js.'
    : '\nBackfill complete. Now run: node scripts/verify-backfill.js');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
