import { sequelize } from './sequelize.js';
import { syncDatabase } from '../models/index.js';

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Database Connected successfully via Sequelize');
    await syncDatabase();
  } catch (error) {
    console.error(`MySQL Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export { sequelize };
export default connectDB;
