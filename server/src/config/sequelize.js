import { Sequelize } from 'sequelize';

// ── Tenant Connection Pool Manager ──
// Manages separate Sequelize instances per tenant, each pointing to their own database.
// Connections are cached and reused across requests.

const tenantConnections = new Map();

/**
 * Create a Sequelize instance for a specific database name.
 */
const createConnection = (dbName) => {
  return new Sequelize(
    dbName,
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
        paranoid: false,
      },
    }
  );
};

/**
 * Get or create a cached Sequelize connection for a tenant.
 * @param {string} dbName - The tenant's database name (e.g., "db_apexarena")
 * @returns {Sequelize} Cached Sequelize instance
 */
export const getTenantConnection = (dbName) => {
  if (tenantConnections.has(dbName)) {
    return tenantConnections.get(dbName);
  }

  const connection = createConnection(dbName);
  tenantConnections.set(dbName, connection);
  return connection;
};

/**
 * Remove a tenant connection from the cache (e.g., when tenant is deleted).
 * @param {string} dbName
 */
export const removeTenantConnection = async (dbName) => {
  if (tenantConnections.has(dbName)) {
    const connection = tenantConnections.get(dbName);
    await connection.close();
    tenantConnections.delete(dbName);
    
    // Clear models bound to this connection from cache
    try {
      const { clearModelCache } = await import('../models/model-factory.js');
      clearModelCache(dbName);
    } catch (e) {
      console.warn('Error clearing model cache:', e.message);
    }
  }
};

/**
 * Close all cached tenant connections (for graceful shutdown).
 */
export const closeAllConnections = async () => {
  const { clearModelCache } = await import('../models/model-factory.js');
  for (const [dbName, connection] of tenantConnections) {
    await connection.close();
    clearModelCache(dbName);
    console.log(`Closed connection to ${dbName}`);
  }
  tenantConnections.clear();
};

// ── Legacy single-instance export (for backward compatibility during migration) ──
// This will be removed once all code uses the tenant middleware pattern.
const sequelize = createConnection(process.env.DB_NAME || 'indoor_sports_db');

export { sequelize };
export default sequelize;
