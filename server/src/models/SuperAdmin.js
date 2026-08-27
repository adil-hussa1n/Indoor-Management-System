import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

// Platform-wide account, not scoped to any business — moved from
// server/src/models/master/SuperAdmin.js into the single shared database.
const SuperAdmin = sequelize.define('SuperAdmin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'superadmin',
  },
}, {
  tableName: 'super_admins',
  timestamps: true,
});

export default SuperAdmin;
