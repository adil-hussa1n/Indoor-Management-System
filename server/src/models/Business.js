import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

// ── Business Model ──
// Replaces the former master-DB `Tenant` model (server/src/models/master/Tenant.js).
// An ordinary row-owning table in the single shared database — every
// business-owned model carries a `businessId` FK to this table
// (constitution Principle I.2). `dbName` is dropped: there is no longer a
// per-tenant physical database to name. `slug` is retained solely for
// public-storefront hostname resolution (constitution Principle V) — it
// carries no authority over authenticated request scoping.
const Business = sequelize.define('Business', {
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
      is: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i,
      len: [2, 63],
    },
    comment: 'Public-storefront subdomain slug, e.g. "apexarena" — public routes only, never used to scope authenticated requests.',
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  adminEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isEmail: true },
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
  },
  smsCredentials: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Per-business SMS API credentials (encrypted in production)',
  },
  subscriptionPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  subscriptionPlan: {
    type: DataTypes.STRING,
    defaultValue: '1_month',
  },
  totalRevenueCollected: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  paymentStatus: {
    type: DataTypes.STRING,
    defaultValue: 'paid',
  },
  lastPaymentDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  allowPaymentGateway: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'businesses',
  timestamps: true,
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['isActive'] },
    { fields: ['customDomain'], unique: true },
  ],
});

export default Business;
