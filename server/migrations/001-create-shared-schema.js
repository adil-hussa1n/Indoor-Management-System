import { sequelize } from '../src/config/db.js';
import { createModels } from '../src/models/model-factory.js';

// ── Migration 001: Create Shared Schema ──
// Rollout Phase 1 (plan.md) — additive only. Creates the `businesses`
// table and every business-owned table (with `businessId` still nullable
// at this point — Phase 3/migration 002 tightens it after backfill is
// verified). Source of truth for column definitions is
// server/src/models/model-factory.js — this migration just materializes it,
// so there is one schema definition, not two drifting copies.
//
// Note: MySQL DDL (CREATE TABLE/ALTER TABLE) is not transactional — each
// statement commits immediately regardless of the surrounding migration
// runner transaction, which only wraps the schema_migrations bookkeeping
// insert. This mirrors MySQL's actual behavior rather than pretending
// otherwise.

export default {
  async up() {
    createModels(sequelize); // defines Business + all 17 business-owned models on the shared connection
    await sequelize.sync({ alter: false }); // CREATE TABLE IF NOT EXISTS for every defined model
  },
};
