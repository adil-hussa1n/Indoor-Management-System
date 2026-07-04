import { DataTypes } from 'sequelize';
import { sequelize } from '../config/sequelize.js';

const SlotLock = sequelize.define('SlotLock', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  startTime: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lockedBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'slot_locks',
  timestamps: true,
  indexes: [
    {
      fields: ['expiresAt'],
    },
    {
      fields: ['date', 'startTime'],
    },
  ],
});

export default SlotLock;
