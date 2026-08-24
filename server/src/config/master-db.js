import { Sequelize } from 'sequelize';

// ── Master Database Connection ──
// This connects to the master database that stores tenant registry + super admin accounts.
// It does NOT store any tenant-specific data (bookings, slots, settings, etc.)

const masterSequelize = new Sequelize(
  process.env.MASTER_DB_NAME || 'indoor_master_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    dialectOptions: {
      connectTimeout: 2000, // 2-second fast connection timeout
    },
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 3000,
      idle: 10000,
    },
    timezone: '+00:00',
    define: {
      timestamps: true,
    },
  }
);

export { masterSequelize };
export default masterSequelize;
