import { syncMasterDatabase } from '../models/master/index.js';
import { masterSequelize } from '../config/master-db.js';

const connectDB = async () => {
  try {
    // 1. Connect and sync the master database (tenant registry)
    await syncMasterDatabase();
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.warn(`⚠️ Master Database Notice (${process.env.DB_HOST}): ${error.message}`);
    console.warn('   (Note: If hosted on cPanel/VPS, ensure Remote MySQL allows your IP address)');
  }
};

export { masterSequelize };
export default connectDB;
