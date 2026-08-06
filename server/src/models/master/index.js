import { masterSequelize } from '../../config/master-db.js';
import Tenant from './Tenant.js';
import SuperAdmin from './SuperAdmin.js';
import SubscriptionHistory from './SubscriptionHistory.js';

Tenant.hasMany(SubscriptionHistory, { foreignKey: 'tenantId', as: 'subscriptionHistories' });
SubscriptionHistory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// Sync master database tables
const syncMasterDatabase = async () => {
  try {
    await masterSequelize.authenticate();
    console.log('Master database connected successfully');

    // Pre-sync column additions for tenants table
    const columns = [
      "ALTER TABLE `tenants` ADD COLUMN `subscriptionPrice` DECIMAL(10,2) DEFAULT 0.00",
      "ALTER TABLE `tenants` ADD COLUMN `subscriptionPlan` VARCHAR(255) DEFAULT '1_month'",
      "ALTER TABLE `tenants` ADD COLUMN `totalRevenueCollected` DECIMAL(10,2) DEFAULT 0.00",
      "ALTER TABLE `tenants` ADD COLUMN `paymentStatus` VARCHAR(255) DEFAULT 'paid'",
      "ALTER TABLE `tenants` ADD COLUMN `lastPaymentDate` DATETIME NULL",
    ];

    for (const q of columns) {
      try {
        await masterSequelize.query(q);
      } catch (e) {
        // Column already exists
      }
    }

    await masterSequelize.sync({ alter: false });
    console.log('Master database tables synced');
  } catch (error) {
    console.error('Master database connection error:', error.message);
    throw error;
  }
};

export { masterSequelize, Tenant, SuperAdmin, SubscriptionHistory, syncMasterDatabase };
