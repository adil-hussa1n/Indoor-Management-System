import { masterSequelize } from '../../config/master-db.js';
import Tenant from './Tenant.js';
import SuperAdmin from './SuperAdmin.js';

// Sync master database tables
const syncMasterDatabase = async () => {
  try {
    await masterSequelize.authenticate();
    console.log('Master database connected successfully');
    await masterSequelize.sync({ alter: false });
    console.log('Master database tables synced');
  } catch (error) {
    console.error('Master database connection error:', error.message);
    throw error;
  }
};

export { masterSequelize, Tenant, SuperAdmin, syncMasterDatabase };
