import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { DataTypes } from 'sequelize';
import { sequelize } from '../src/config/db.js';

// ── Migration Runner ──
// Applies every numbered migration file in this directory, in order,
// exactly once, tracked in a `schema_migrations` table. Run with:
//   npm run migrate
// Each migration file default-exports an async (queryInterface, Sequelize) => {}
// function — the same shape Sequelize CLI migrations use, so these are
// portable to `sequelize-cli` later if desired without a rewrite.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ensureMigrationsTable = async () => {
  const qi = sequelize.getQueryInterface();
  const tables = await qi.showAllTables();
  if (!tables.includes('schema_migrations')) {
    await qi.createTable('schema_migrations', {
      name: { type: DataTypes.STRING, primaryKey: true },
      appliedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
  }
};

const getAppliedMigrations = async () => {
  const [rows] = await sequelize.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
};

const run = async () => {
  await sequelize.authenticate();
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(__dirname)
    .filter((f) => /^\d{3}-.*\.js$/.test(f))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const qi = sequelize.getQueryInterface();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    console.log(`apply ${file} ...`);
    const migration = (await import(pathToFileURL(path.join(__dirname, file)).href)).default;
    const t = await sequelize.transaction();
    try {
      await migration.up(qi, sequelize.Sequelize ?? sequelize.constructor, t);
      await sequelize.query(
        'INSERT INTO schema_migrations (name, appliedAt) VALUES (:name, NOW())',
        { replacements: { name: file }, transaction: t }
      );
      await t.commit();
      console.log(`✅ applied ${file}`);
    } catch (err) {
      await t.rollback();
      console.error(`❌ failed on ${file}:`, err.message);
      throw err;
    }
  }

  console.log('All migrations applied.');
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration run failed:', err);
    process.exit(1);
  });
