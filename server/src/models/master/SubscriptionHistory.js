import { DataTypes } from 'sequelize';
import { masterSequelize } from '../../config/master-db.js';

const SubscriptionHistory = masterSequelize.define('SubscriptionHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tenantSlug: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  plan: {
    type: DataTypes.STRING,
    defaultValue: '1_month',
  },
  planName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  paymentStatus: {
    type: DataTypes.STRING,
    defaultValue: 'paid',
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notes: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'subscription_histories',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['tenantSlug'] },
  ],
});

export default SubscriptionHistory;
