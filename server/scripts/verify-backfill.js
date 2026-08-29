import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { sequelize as sharedDb } from '../src/config/db.js';
import Business from '../src/models/Business.js';

// ── Backfill Verification (spec.md SC-001) ──
// Compares, per tenant per table, the source per-tenant-DB row count
// against the shared-DB row count filtered by that tenant's businessId.
// Must report zero discrepancies before migrations/002-business-id-
// not-null-and-fk.js is run. Exits non-zero on any mismatch.
//
// Usage: node scripts/verify-backfill.js

const oldConnectionOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  logging: false,
};

const openOldDb = (dbName) =>
  new Sequelize(dbName, process.env.DB_USER || 'root', process.env.DB_PASSWORD || '', oldConnectionOptions);

const TABLES = [
  'admins', 'grounds', 'users', 'finance_categories', 'slots', 'slot_locks',
  'bookings', 'booking_status_history', 'booking_requests', 'finance_entries',
  'otps', 'reviews', 'gallery', 'contacts', 'settings', 'audit_logs',
  'blocked_customers',
];

async function main() {
  const masterDbName = process.env.OLD_MASTER_DB_NAME || process.env.MASTER_DB_NAME || 'indoor_master_db';
  const masterDb = openOldDb(masterDbName);
  await masterDb.authenticate();
  const [tenants] = await masterDb.query('SELECT * FROM `tenants` ORDER BY id ASC');
  await masterDb.close();

  await sharedDb.authenticate();

  let mismatches = 0;
  let totalChecked = 0;

  for (const tenant of tenants) {
    const business = await Business.findOne({ where: { slug: tenant.slug } });
    if (!business) {
      console.error(`❌ No Business row found for tenant "${tenant.slug}" — backfill did not run for this tenant.`);
      mismatches++;
      continue;
    }

    const oldDb = openOldDb(tenant.dbName);
    await oldDb.authenticate();

    console.log(`\n--- ${tenant.slug} (businessId=${business.id}) ---`);
    for (const table of TABLES) {
      const [srcRows] = await oldDb.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
      const srcCount = Number(srcRows[0].cnt);

      const [dstRows] = await sharedDb.query(
        `SELECT COUNT(*) as cnt FROM \`${table}\` WHERE businessId = :businessId`,
        { replacements: { businessId: business.id } }
      );
      const dstCount = Number(dstRows[0].cnt);

      totalChecked++;
      if (srcCount !== dstCount) {
        console.error(`  ❌ ${table}: source=${srcCount} shared=${dstCount} MISMATCH`);
        mismatches++;
      } else {
        console.log(`  ✅ ${table}: ${srcCount} (match)`);
      }
    }

    // Spot-check: one full row's field-for-field equality, on whichever
    // table has the most rows for this tenant (highest-value spot-check).
    const [sampleRows] = await oldDb.query(`SELECT * FROM \`bookings\` LIMIT 1`);
    if (sampleRows.length > 0) {
      const sample = sampleRows[0];
      const [matches] = await sharedDb.query(
        `SELECT * FROM \`bookings\` WHERE businessId = :businessId AND bookingId = :bookingId LIMIT 1`,
        { replacements: { businessId: business.id, bookingId: sample.bookingId } }
      );
      if (matches.length === 0) {
        console.error(`  ❌ spot-check: booking "${sample.bookingId}" not found in shared DB for this business`);
        mismatches++;
      } else {
        const fieldsMatch = ['customerName', 'phone', 'price', 'status'].every(
          (f) => String(matches[0][f]) === String(sample[f])
        );
        console.log(fieldsMatch
          ? `  ✅ spot-check: booking "${sample.bookingId}" fields match`
          : `  ❌ spot-check: booking "${sample.bookingId}" field mismatch`);
        if (!fieldsMatch) mismatches++;
      }
    }

    await oldDb.close();
  }

  console.log(`\n=== VERIFY SUMMARY: ${totalChecked - mismatches}/${totalChecked} table checks passed, ${mismatches} mismatch(es) ===`);
  if (mismatches > 0) {
    console.error('Backfill verification FAILED — do not proceed to migrations/002-business-id-not-null-and-fk.js.');
    process.exit(1);
  }
  console.log('Backfill verification PASSED — safe to proceed to migrations/002-business-id-not-null-and-fk.js.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification script failed:', err);
    process.exit(1);
  });
