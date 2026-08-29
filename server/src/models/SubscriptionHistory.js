import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

// Platform-wide (Super Admin-facing) history of a Business's subscription
// changes — moved from server/src/models/master/SubscriptionHistory.js into
// the single shared database. `tenantId` is kept as the field name for
// backward-compatible reads of existing history rows but now references
// `Business.id`.
const SubscriptionHistory = sequelize.define('SubscriptionHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'References Business.id',
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
