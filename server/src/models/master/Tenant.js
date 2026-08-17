import { DataTypes } from 'sequelize';
import { masterSequelize } from '../../config/master-db.js';

const Tenant = masterSequelize.define('Tenant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  slug: {
    type: DataTypes.STRING(63),
    allowNull: false,
    unique: true,
    validate: {
      is: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i, // valid subdomain
      len: [2, 63],
    },
    comment: 'Subdomain slug, e.g. "apexarena" → apexarena.yourdomain.com',
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dbName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Auto-generated database name, e.g. "db_apexarena"',
  },
  adminEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  adminPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  plan: {
    type: DataTypes.ENUM('free', 'basic', 'pro'),
    defaultValue: 'free',
  },
  subscriptionExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  customDomain: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Optional custom domain, e.g. "booking.clientsite.com"',
  },
  smsCredentials: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Per-tenant SMS API credentials (encrypted in production)',
  },
  subscriptionPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: 'Price charged for current subscription plan',
  },
  subscriptionPlan: {
    type: DataTypes.STRING,
    defaultValue: '1_month',
    comment: 'Plan duration: 1_month, 3_months, 6_months, 1_year, lifetime',
  },
  totalRevenueCollected: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: 'Cumulative revenue collected from this tenant instance',
  },
  paymentStatus: {
    type: DataTypes.STRING,
    defaultValue: 'paid',
    comment: 'Payment status: paid, pending, overdue',
  },
  lastPaymentDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  allowPaymentGateway: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Super Admin master flag to enable/disable automated online payment gateways for this tenant',
  },
}, {
  tableName: 'tenants',
  timestamps: true,
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['isActive'] },
    { fields: ['customDomain'], unique: true },
  ],
});

export default Tenant;
