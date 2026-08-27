import { Sequelize } from 'sequelize';

// ── Single Shared-Database Connection ──
// Per constitution Principle I.1: one MySQL database for the whole service.
// Replaces the former split between a per-tenant connection pool
// (config/sequelize.js) and a separate master-registry connection
// (config/master-db.js) — both are retired once this is fully wired in
// (see specs/001-shared-db-business-tenancy/plan.md Phase 5).

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'indoor_management_system',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    dialectOptions: {
      connectTimeout: 2000,
    },
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 3000,
      idle: 10000,
    },
    timezone: '+00:00',
    define: {
      timestamps: true,
      paranoid: false,
    },
  }
);

/**
 * Connect to the shared database and define every model against this one
 * connection, exactly once at boot (research.md Decision 1). Table
 * creation/alteration is expected to happen via server/migrations/, not via
 * sequelize.sync() at request time or even at boot in production — sync()
 * here is a local-dev convenience only.
 */
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: false });
      console.log('✅ Database schema synced (dev convenience — production uses server/migrations/)');
    }
  } catch (error) {
    console.warn(`⚠️ Database connection notice (${process.env.DB_HOST}): ${error.message}`);
    console.warn('   (Note: If hosted on cPanel/VPS, ensure Remote MySQL allows your IP address)');
  }
};

export default connectDB;
