import { syncMasterDatabase } from '../models/master/index.js';
import { masterSequelize } from '../config/master-db.js';

const connectDB = async () => {
  try {
    // 1. Connect and sync the master database (tenant registry)
    await syncMasterDatabase();

    // 2. Create master database if it doesn't exist
    // (Sequelize needs the DB to exist before connecting)
    // This is handled by the MySQL init script or docker-compose

    console.log('Database initialization complete');
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export { masterSequelize };
export default connectDB;
