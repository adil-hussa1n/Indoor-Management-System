import { DataTypes } from 'sequelize';

// ── Model Factory ──
// Creates all tenant-scoped models bound to a specific Sequelize instance.
// This allows the same model definitions to work across different tenant databases.

const modelCache = new Map();

/**
 * Define all tenant-scoped models on a given Sequelize instance.
 * Results are cached per instance to avoid re-definition.
 * @param {import('sequelize').Sequelize} sequelize - The tenant's Sequelize instance
 * @returns {Object} All models + sequelize instance + sync function
 */
export function createModels(sequelize) {
  // Return cached models if already created for this connection
  const cacheKey = sequelize.config.database;
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey);
  }

  // ── Admin Model ──
  const Admin = sequelize.define('Admin', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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
  }, {
    tableName: 'admins',
    timestamps: true,
  });

  // ── Booking Model ──
  const Booking = sequelize.define('Booking', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
      type: DataTypes.ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled'),
      defaultValue: 'Pending',
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'bookings',
    timestamps: true,
    paranoid: true,
    version: true,
    indexes: [
      { fields: ['bookingDate'] },
      { fields: ['startTime'] },
      { fields: ['status'] },
      { fields: ['phone'] },
      { fields: ['userId'] },
    ],
  });

  // ── BookingStatusHistory Model ──
  const BookingStatusHistory = sequelize.define('BookingStatusHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
  });

  // ── BookingRequest Model ──
  const BookingRequest = sequelize.define('BookingRequest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
  }, {
    tableName: 'booking_requests',
    timestamps: true,
    indexes: [
      { fields: ['bookingId'] },
      { fields: ['userId'] },
      { fields: ['status'] },
    ],
  });

  // ── Slot Model ──
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
  }, {
    tableName: 'slots',
    timestamps: true,
    indexes: [
      { fields: ['dayOfWeek'] },
      { fields: ['specificDate'] },
      { fields: ['isActive'] },
    ],
  });

  // ── SlotLock Model ──
  const SlotLock = sequelize.define('SlotLock', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
  }, {
    tableName: 'slot_locks',
    timestamps: true,
    indexes: [
      { fields: ['bookingDate', 'startTime', 'endTime'] },
      { fields: ['expiresAt'] },
    ],
  });

  // ── User Model ──
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
      unique: true,
      validate: { len: [7, 20] },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
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
      { fields: ['phone'], unique: true },
    ],
  });

  // ── OTP Model ──
  const OTP = sequelize.define('OTP', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
  });

  // ── Gallery Model ──
  const Gallery = sequelize.define('Gallery', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
  });

  // ── Contact Model ──
  const Contact = sequelize.define('Contact', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
  });

  // ── Settings Model ──
  const Settings = sequelize.define('Settings', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    businessHours: {
      type: DataTypes.JSON,
      defaultValue: {
        weekdayStart: '08:00 AM',
        weekdayEnd: '10:00 PM',
        weekendStart: '08:00 AM',
        weekendEnd: '11:00 PM',
      },
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
  }, {
    tableName: 'settings',
    timestamps: true,
    version: true,
  });

  // ── BlockedCustomer Model ──
  const BlockedCustomer = sequelize.define('BlockedCustomer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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
      { fields: ['phone'], unique: true },
    ],
  });

  // ── AuditLog Model ──
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entityId: {
      type: DataTypes.INTEGER,
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
  });

  // ── Associations ──
  Booking.hasMany(BookingStatusHistory, { foreignKey: 'bookingId', as: 'statusHistory' });
  BookingStatusHistory.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

  User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
  Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(BookingRequest, { foreignKey: 'userId', as: 'requests' });
  BookingRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Booking.hasMany(BookingRequest, { foreignKey: 'bookingId', as: 'requests' });
  BookingRequest.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

  // ── Sync function ──
  const syncDatabase = async () => {
    try {
      await sequelize.sync({ alter: false });
      console.log(`Tenant DB [${sequelize.config.database}] synced successfully`);
    } catch (error) {
      console.error(`Error syncing tenant DB [${sequelize.config.database}]:`, error.message);
      throw error;
    }
  };

  const models = {
    sequelize,
    Admin,
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
    syncDatabase,
  };

  modelCache.set(cacheKey, models);
  return models;
}

/**
 * Clear cached models for a tenant (e.g., when connection is closed).
 * @param {string} dbName
 */
export function clearModelCache(dbName) {
  modelCache.delete(dbName);
}
