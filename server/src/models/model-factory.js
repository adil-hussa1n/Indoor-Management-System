import { DataTypes } from 'sequelize';
import Business from './Business.js';

// ── Model Factory ──
// Defines every business-owned model against the single shared-database
// Sequelize connection (server/src/config/db.js). Historically this factory
// was invoked once per tenant-specific connection ("createModels(tenantDb)")
// to re-define the same schema against a different physical database per
// tenant; per constitution Principle I and
// specs/001-shared-db-business-tenancy/plan.md (research.md Decision 1),
// it is now invoked exactly once at application boot against the one
// shared connection. The per-connection cache below is retained only so
// re-importing this module (e.g. across test files) is idempotent — it is
// no longer a tenant cache.

const modelCache = new Map();

/**
 * Define all business-owned models on the shared Sequelize instance.
 * Idempotent: calling this more than once against the same connection
 * returns the already-defined models rather than redefining them.
 * @param {import('sequelize').Sequelize} sequelize - The shared connection
 * @returns {Object} All models + sequelize instance + sync function
 */
export function createModels(sequelize) {
  const cacheKey = sequelize.config.database;
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey);
  }

  // Every businessId column below is `allowNull: false` with a `RESTRICT`
  // FK to Business — verified end-to-end against a real MySQL instance via
  // migrations/001-create-shared-schema.js + migrations/002-business-id-
  // not-null-and-fk.js (plan.md Phases 1 and 3). Deploying this model
  // definition against a production database that has NOT yet had its
  // real per-tenant data backfilled (scripts/backfill-business-data.js) and
  // migration 002 applied will fail loudly on any write — that is the
  // correct, safe failure mode; do not weaken this back to `allowNull: true`
  // as a workaround. Run the migrations in order first.

  // ── Admin Model ──
  const Admin = sequelize.define('Admin', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [3, 50] },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'admin',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'admins',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
      { unique: true, fields: ['businessId', 'username'], name: 'idx_admins_unique_business_username' },
    ],
  });

  // ── Booking Model ──
  const Booking = sequelize.define('Booking', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    bookingId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // nullable for guest bookings
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [2, 100] },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [7, 20] },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      set(val) {
        this.setDataValue('email', val === '' ? null : val);
      },
      validate: { isEmail: true },
    },
    sport: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Football',
    },
    bookingDate: {
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
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },
    players: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Pending',
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    groundId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    paymentStatus: {
      type: DataTypes.STRING,
      defaultValue: 'unpaid',
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
    },
    dueAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
    },
    paymentGateway: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentDetails: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'bookings',
    timestamps: true,
    paranoid: true,
    version: true,
    indexes: [
      { fields: ['businessId'] },
      { fields: ['bookingDate'] },
      { fields: ['startTime'] },
      { fields: ['status'] },
      { fields: ['phone'] },
      { fields: ['userId'] },
      { fields: ['groundId'] },
    ],
  });

  // ── BookingStatusHistory Model ──
  const BookingStatusHistory = sequelize.define('BookingStatusHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bookingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    previousStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    newStatus: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    changedBy: {
      type: DataTypes.STRING,
      defaultValue: 'system',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'booking_status_history',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── BookingRequest Model ──
  const BookingRequest = sequelize.define('BookingRequest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    bookingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('change', 'cancel'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false,
    },
    requestData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '{ newDate, newStartTime, newEndTime, reason }',
    },
    adminNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isSuspicious: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    suspiciousReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'booking_requests',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
      { fields: ['bookingId'] },
      { fields: ['userId'] },
      { fields: ['status'] },
    ],
  });

  // ── Ground Model ──
  const Ground = sequelize.define('Ground', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sport: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
  }, {
    tableName: 'grounds',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── Slot Model ──
  const Slot = sequelize.define('Slot', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
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
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    dayOfWeek: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: -1,
      comment: '-1 = all days, 0-6 = Sun-Sat',
    },
    specificDate: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'YYYY-MM-DD for date-specific overrides',
    },
    rateType: {
      type: DataTypes.ENUM('day', 'night'),
      defaultValue: 'day',
    },
    groundId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'slots',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
      { fields: ['dayOfWeek'] },
      { fields: ['specificDate'] },
      { fields: ['isActive'] },
      { fields: ['groundId'] },
      {
        unique: true,
        fields: ['businessId', 'startTime', 'endTime', 'dayOfWeek', 'specificDate', 'groundId'],
        name: 'idx_slots_unique_time_ground'
      }
    ],
  });

  // ── SlotLock Model ──
  const SlotLock = sequelize.define('SlotLock', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bookingDate: {
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
    sessionId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    groundId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'slot_locks',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
      { fields: ['bookingDate', 'startTime', 'endTime', 'groundId'] },
      { fields: ['expiresAt'] },
    ],
  });

  // ── User Model (customer) ──
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [7, 20] },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      set(val) {
        this.setDataValue('email', val === '' ? null : val);
      },
      validate: { isEmail: true },
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
      { unique: true, fields: ['businessId', 'phone'], name: 'idx_users_unique_business_phone' },
    ],
  });

  // ── OTP Model ──
  const OTP = sequelize.define('OTP', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'otps',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['businessId'] },
      { fields: ['phone'] },
      { fields: ['expiresAt'] },
    ],
  });

  // ── Review Model ──
  const Review = sequelize.define('Review', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'reviews',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── Gallery Model ──
  const Gallery = sequelize.define('Gallery', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    caption: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is360: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    mediaType: {
      type: DataTypes.ENUM('image', 'video', 'panorama'),
      defaultValue: 'image',
    },
  }, {
    tableName: 'gallery',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── Contact Model ──
  const Contact = sequelize.define('Contact', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isReplied: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'contacts',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── Settings Model ──
  const Settings = sequelize.define('Settings', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    logo: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    heroBanner: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    hero: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        mediaType: 'image',
        autoRotate360: true,
        overlayTitle: '',
        overlaySubtitle: '',
      },
    },
    businessName: {
      type: DataTypes.STRING,
      defaultValue: 'Indoor Sports Arena',
    },
    contactEmail: {
      type: DataTypes.STRING,
      defaultValue: 'info@example.com',
    },
    contactPhone: {
      type: DataTypes.STRING,
      defaultValue: '+880-1234-567890',
    },
    contactAddress: {
      type: DataTypes.TEXT,
      defaultValue: 'Dhaka, Bangladesh',
    },
    businessAddress: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    contactMethods: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    registrationNo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    taxId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    establishedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    employeeRange: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'BDT',
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'Asia/Dhaka',
    },
    logoMeta: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    heroBannerMeta: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    businessHours: {
      type: DataTypes.JSON,
      defaultValue: {
        weekdayStart: '08:00 AM',
        weekdayEnd: '10:00 PM',
        weekendStart: '08:00 AM',
        weekendEnd: '11:00 PM',
      },
    },
    // Per-day-of-week schedule, additive alongside the flat weekday/weekend
    // `businessHours` above (kept as-is for backward compat with existing
    // rows/frontend) — matches business_backend/restaurant_backend's
    // per-day BusinessHour model granularity.
    businessHoursDetailed: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    pricing: {
      type: DataTypes.JSON,
      defaultValue: {
        weekdayDay: 1500,
        weekdayNight: 2000,
        weekendDay: 2000,
        weekendNight: 2500,
        holidayDay: 2500,
        holidayNight: 3000,
      },
    },
    weekendDays: {
      type: DataTypes.JSON,
      defaultValue: [5, 6],
    },
    socialLinks: {
      type: DataTypes.JSON,
      defaultValue: { facebook: '', instagram: '', youtube: '' },
    },
    seo: {
      type: DataTypes.JSON,
      defaultValue: {
        title: 'Indoor Sports Arena — Book Your Court',
        description: 'Premium indoor sports facility',
        favicon: '',
      },
    },
    googleMapUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    holidays: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    maintenanceDays: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    availableSports: {
      type: DataTypes.JSON,
      defaultValue: ['Football', 'Cricket', 'Badminton'],
    },
    theme: {
      type: DataTypes.JSON,
      defaultValue: {
        primaryColor: '#7c3aed',
        accentColor: '#a855f7',
      },
    },
    enableDarkMode: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    rules: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    discounts: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    maintenanceMode: {
      type: DataTypes.JSON,
      defaultValue: {
        enabled: false,
        message: '⚠️ Online booking is temporarily paused for system maintenance. Please contact venue management for manual reservations.',
        until: null,
        disabledBy: 'admin',
      },
    },
    paymentConfig: {
      type: DataTypes.JSON,
      defaultValue: {
        enabled: false,
        type: 'full',
        partialType: 'percentage',
        partialPercentage: 50,
        partialFixedAmount: 500,
        gateways: {
          bkash: {
            enabled: true,
            accountType: 'Personal',
            merchantNumber: '',
            appKey: '',
            appSecret: '',
            username: '',
            password: '',
            isLive: false,
          },
          sslcommerz: {
            enabled: true,
            storeId: '',
            storePassword: '',
            isLive: false,
          }
        }
      },
    },
  }, {
    tableName: 'settings',
    timestamps: true,
    version: true,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── BlockedCustomer Model ──
  const BlockedCustomer = sequelize.define('BlockedCustomer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [7, 20] },
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isPermanent: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'blocked_customers',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
      { unique: true, fields: ['businessId', 'phone'], name: 'idx_blocked_customers_unique_business_phone' },
    ],
  });

  // ── AuditLog Model ──
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    adminUsername: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      defaultValue: 'general',
    },
    entity: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    oldValue: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    newValue: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── FinanceCategory Model ──
  const FinanceCategory = sequelize.define('FinanceCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('investment', 'expense'),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'finance_categories',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── FinanceEntry Model ──
  const FinanceEntry = sequelize.define('FinanceEntry', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    businessId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('investment', 'expense'),
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.STRING,
      defaultValue: 'Cash',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    referenceNo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    groundId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'finance_entries',
    timestamps: true,
    indexes: [
      { fields: ['businessId'] },
    ],
  });

  // ── Associations ──
  for (const model of [
    Admin, Booking, BookingStatusHistory, BookingRequest, Ground, Slot,
    SlotLock, User, OTP, Review, Gallery, Contact, Settings, AuditLog,
    BlockedCustomer, FinanceCategory, FinanceEntry,
  ]) {
    // onDelete: 'RESTRICT' (not Sequelize's default 'SET NULL') — a business
    // must be explicitly deactivated (Business.isActive), never silently
    // orphan its rows by cascading a null into businessId; this also keeps
    // the FK compatible with businessId being NOT NULL (plan.md Phase 3).
    model.belongsTo(Business, { foreignKey: 'businessId', as: 'business', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  }

  Booking.hasMany(BookingStatusHistory, { foreignKey: 'bookingId', as: 'statusHistory' });
  BookingStatusHistory.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

  User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
  Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(BookingRequest, { foreignKey: 'userId', as: 'requests' });
  BookingRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Booking.hasMany(BookingRequest, { foreignKey: 'bookingId', as: 'requests' });
  BookingRequest.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

  Ground.hasMany(Slot, { foreignKey: 'groundId', as: 'slots' });
  Slot.belongsTo(Ground, { foreignKey: 'groundId', as: 'ground' });

  Ground.hasMany(Booking, { foreignKey: 'groundId', as: 'bookings' });
  Booking.belongsTo(Ground, { foreignKey: 'groundId', as: 'ground' });

  Ground.hasMany(SlotLock, { foreignKey: 'groundId', as: 'slotLocks' });
  SlotLock.belongsTo(Ground, { foreignKey: 'groundId', as: 'ground' });

  FinanceCategory.hasMany(FinanceEntry, { foreignKey: 'categoryId', as: 'entries' });
  FinanceEntry.belongsTo(FinanceCategory, { foreignKey: 'categoryId', as: 'category' });

  Ground.hasMany(FinanceEntry, { foreignKey: 'groundId', as: 'financeEntries' });
  FinanceEntry.belongsTo(Ground, { foreignKey: 'groundId', as: 'ground' });

  // ── Sync function (local-dev convenience only — production applies
  // server/migrations/ instead, per plan.md's phased rollout) ──
  const syncDatabase = async () => {
    try {
      await sequelize.sync({ alter: false });
      console.log(`Database [${sequelize.config.database}] synced successfully`);
    } catch (error) {
      console.error(`Error syncing database [${sequelize.config.database}]:`, error.message);
      throw error;
    }
  };

  const models = {
    sequelize,
    Business,
    Admin,
    Ground,
    Booking,
    BookingStatusHistory,
    BookingRequest,
    Slot,
    SlotLock,
    User,
    OTP,
    Review,
    Gallery,
    Contact,
    Settings,
    AuditLog,
    BlockedCustomer,
    FinanceCategory,
    FinanceEntry,
    syncDatabase,
  };

  modelCache.set(cacheKey, models);
  return models;
}

/**
 * Clear cached models (e.g. between test files against a fresh connection).
 * @param {string} dbName
 */
export function clearModelCache(dbName) {
  modelCache.delete(dbName);
}
