import { DataTypes } from 'sequelize';
import { sequelize } from '../config/sequelize.js';

const Slot = sequelize.define('Slot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  startTime: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  dayOfWeek: {
    type: DataTypes.INTEGER, // -1 = default daily, 0-6 = Sunday-Saturday
    defaultValue: -1,
  },
  specificDate: {
    type: DataTypes.STRING, // "YYYY-MM-DD"
    allowNull: true,
    defaultValue: null,
  },
  rateType: {
    type: DataTypes.STRING,
    defaultValue: 'day', // 'day' or 'night'
  },
}, {
  tableName: 'slots',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['startTime', 'endTime', 'dayOfWeek', 'specificDate'],
    },
    {
      fields: ['dayOfWeek'],
    },
    {
      fields: ['specificDate'],
    },
  ],
});

export default Slot;
