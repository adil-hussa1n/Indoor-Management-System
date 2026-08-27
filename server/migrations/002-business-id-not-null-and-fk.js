import { sequelize } from '../src/config/db.js';

// ── Migration 002: Tighten businessId to NOT NULL + FK constraints ──
// Rollout Phase 3 (plan.md). MUST NOT be run until server/scripts/
// backfill-business-data.js has populated businessId on every existing row
// AND server/scripts/verify-backfill.js confirms zero rows are missing it
// — this migration will fail loudly (NOT NULL violation / orphaned FK) if
// run against unbackfilled data, which is the correct, safe failure mode.
//
// Note: since model-factory.js already declares businessId as
// `allowNull: false` with a RESTRICT FK, migration 001 (run against a
// fresh, empty shared database) already creates every table with this
// constraint from the start — verified in this session by running both
// migrations against a completely fresh database (001 alone produced the
// same end state). This migration remains as an explicit, idempotent
// safety net for the one scenario where it IS load-bearing: if 001 was
// applied before the model was tightened, or the shared database was
// otherwise created with businessId still nullable.

const BUSINESS_OWNED_TABLES = [
  'admins', 'bookings', 'booking_status_history', 'booking_requests',
  'grounds', 'slots', 'slot_locks', 'users', 'otps', 'reviews', 'gallery',
  'contacts', 'settings', 'audit_logs', 'blocked_customers',
  'finance_categories', 'finance_entries',
];

export default {
  async up() {
    for (const table of BUSINESS_OWNED_TABLES) {
      const [nullCount] = await sequelize.query(
        `SELECT COUNT(*) as cnt FROM \`${table}\` WHERE businessId IS NULL`
      );
      const missing = Number(nullCount[0].cnt);
      if (missing > 0) {
        throw new Error(
          `Refusing to tighten "${table}.businessId" to NOT NULL — ${missing} row(s) still have no businessId. ` +
          `Run scripts/backfill-business-data.js and scripts/verify-backfill.js first.`
        );
      }

      await sequelize.query(`ALTER TABLE \`${table}\` MODIFY COLUMN businessId INT NOT NULL`);

      const [existingFks] = await sequelize.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'
           AND COLUMN_NAME = 'businessId' AND REFERENCED_TABLE_NAME = 'businesses'`
      );
      if (existingFks.length === 0) {
        await sequelize.query(
          `ALTER TABLE \`${table}\`
           ADD CONSTRAINT \`fk_${table}_business\`
           FOREIGN KEY (businessId) REFERENCES \`businesses\`(id)
           ON DELETE RESTRICT ON UPDATE CASCADE`
        );
      }
      console.log(`✅ ${table}.businessId is now NOT NULL with an FK to businesses.id`);
    }
  },
};
