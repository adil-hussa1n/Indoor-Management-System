import { Op } from 'sequelize';

// ── Tenant-aware Repository Factory ──
// Each repository function receives models from req.models (set by tenant middleware).
// This replaces the old pattern of importing models directly from a single DB.

// ── Admin Repository ──
export const createAdminRepository = (models) => ({
  findByUsername: (username) => models.Admin.findOne({ where: { username } }),
  findById: (id) => models.Admin.findByPk(id),
  create: (data) => models.Admin.create(data),
});

// ── Booking Repository ──
export const createBookingRepository = (models) => ({
  findAll: (where = {}, options = {}) => models.Booking.findAll({ where, ...options }),
  findAndCountAll: (where = {}, options = {}) => models.Booking.findAndCountAll({ where, ...options }),
  countAll: (where = {}) => models.Booking.count({ where }),
  sumPrice: async (where = {}) => (await models.Booking.sum('price', { where })) || 0,
  findById: (id) => models.Booking.findByPk(id, { include: [{ model: models.BookingStatusHistory, as: 'statusHistory' }] }),
  findByUuid: (uuid) => models.Booking.findOne({ where: { uuid }, include: [{ model: models.BookingStatusHistory, as: 'statusHistory' }] }),
  create: (data, options = {}) => models.Booking.create(data, options),
  update: (id, data, options = {}) => models.Booking.update(data, { where: { id }, ...options }),
  softDelete: (id) => models.Booking.destroy({ where: { id } }),
  countWithPrefix: (prefix) => models.Booking.count({ where: { bookingId: { [Op.like]: `${prefix}%` } }, paranoid: false }),
  findOverlapping: (dateStr, startTime, endTime, options = {}) => {
    return models.Booking.findAll({
      where: {
        bookingDate: dateStr,
        status: { [Op.ne]: 'Cancelled' },
        [Op.or]: [
          { startTime: { [Op.lt]: endTime }, endTime: { [Op.gt]: startTime } },
        ],
      },
      ...options,
    });
  },
  findByDateRange: (startDate, endDate) => {
    return models.Booking.findAll({
      where: { bookingDate: { [Op.between]: [startDate, endDate] } },
      order: [['bookingDate', 'ASC'], ['startTime', 'ASC']],
    });
  },
  findByPhone: (phone) => models.Booking.findAll({ where: { phone }, order: [['createdAt', 'DESC']] }),
  findByUserId: (userId) => models.Booking.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    include: [{ model: models.BookingRequest, as: 'requests' }],
  }),
  getGroupedByDate: (startDate, endDate) => {
    return models.Booking.findAll({
      attributes: [
        'bookingDate',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
        [models.sequelize.fn('SUM',
          models.sequelize.literal("CASE WHEN status = 'Completed' THEN price ELSE 0 END")
        ), 'revenue'],
      ],
      where: {
        bookingDate: { [Op.gte]: startDate, [Op.lte]: endDate },
      },
      group: ['bookingDate'],
      order: [['bookingDate', 'ASC']],
      raw: true,
    });
  },
  getGroupedByStartTime: () => {
    return models.Booking.findAll({
      attributes: [
        'startTime',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
      ],
      group: ['startTime'],
      order: [[models.sequelize.fn('COUNT', models.sequelize.col('id')), 'DESC']],
      raw: true,
    });
  },
  getGroupedByStatus: () => {
    return models.Booking.findAll({
      attributes: [
        'status',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });
  },
});

// ── Slot Repository ──
export const createSlotRepository = (models) => ({
  findAll: (where = {}, options = {}) => models.Slot.findAll({ where, ...options }),
  findById: (id) => models.Slot.findByPk(id),
  create: (data) => models.Slot.create(data),
  update: (id, data) => models.Slot.update(data, { where: { id } }),
  delete: (id) => models.Slot.destroy({ where: { id } }),
  count: (where = {}) => models.Slot.count({ where }),
});

// ── Settings Repository ──
export const createSettingsRepository = (models) => ({
  get: () => models.Settings.findOne(),
  getOrCreate: async () => {
    let settings = await models.Settings.findOne();
    if (!settings) {
      settings = await models.Settings.create({});
    }
    return settings;
  },
  update: (id, data) => models.Settings.update(data, { where: { id } }),
});

// ── Review Repository ──
export const createReviewRepository = (models) => ({
  findAll: (where = {}, options = {}) => models.Review.findAll({ where, ...options }),
  findById: (id) => models.Review.findByPk(id),
  create: (data) => models.Review.create(data),
  update: (id, data) => models.Review.update(data, { where: { id } }),
  delete: (id) => models.Review.destroy({ where: { id } }),
});

// ── Gallery Repository ──
export const createGalleryRepository = (models) => ({
  findAll: (where = {}, options = {}) => models.Gallery.findAll({ where, order: [['order', 'ASC'], ['createdAt', 'DESC']], ...options }),
  findById: (id) => models.Gallery.findByPk(id),
  create: (data) => models.Gallery.create(data),
  update: (id, data) => models.Gallery.update(data, { where: { id } }),
  delete: (id) => models.Gallery.destroy({ where: { id } }),
  count: () => models.Gallery.count(),
  updateOrder: (id, order) => models.Gallery.update({ order }, { where: { id } }),
});

// ── Contact Repository ──
export const createContactRepository = (models) => ({
  findAll: (where = {}, options = {}) => models.Contact.findAll({ where, ...options }),
  findById: (id) => models.Contact.findByPk(id),
  create: (data) => models.Contact.create(data),
  update: (id, data) => models.Contact.update(data, { where: { id } }),
  delete: (id) => models.Contact.destroy({ where: { id } }),
});

// ── BookingStatusHistory Repository ──
export const createBookingStatusHistoryRepository = (models) => ({
  create: (data, options = {}) => models.BookingStatusHistory.create(data, options),
  findByBookingId: (bookingId) => models.BookingStatusHistory.findAll({ where: { bookingId }, order: [['createdAt', 'DESC']] }),
});

// ── AuditLog Repository ──
export const createAuditLogRepository = (models) => ({
  create: (data) => models.AuditLog.create(data),
  findAll: (where = {}, options = {}) => models.AuditLog.findAll({ where, ...options }),
});

// ── SlotLock Repository ──
export const createSlotLockRepository = (models) => ({
  create: (data, options = {}) => models.SlotLock.create(data, options),
  findActive: (bookingDate, startTime, endTime) => {
    return models.SlotLock.findAll({
      where: {
        bookingDate,
        startTime: { [Op.lt]: endTime },
        endTime: { [Op.gt]: startTime },
        expiresAt: { [Op.gt]: new Date() },
      },
    });
  },
  deleteExpired: () => {
    return models.SlotLock.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
  },
  deleteBySessionId: (sessionId) => models.SlotLock.destroy({ where: { sessionId } }),
});

// ── User Repository ──
export const createUserRepository = (models) => ({
  findByPhone: (phone) => models.User.findOne({ where: { phone } }),
  findById: (id) => models.User.findByPk(id),
  findByUuid: (uuid) => models.User.findOne({ where: { uuid } }),
  create: (data) => models.User.create(data),
  update: (id, data) => models.User.update(data, { where: { id } }),
});

// ── OTP Repository ──
export const createOtpRepository = (models) => ({
  create: (data) => models.OTP.create(data),
  findLatest: (phone) => {
    return models.OTP.findOne({
      where: {
        phone,
        isUsed: false,
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });
  },
  markUsed: (id) => models.OTP.update({ isUsed: true }, { where: { id } }),
  incrementAttempts: (id) => models.OTP.increment('attempts', { where: { id } }),
});

// ── BookingRequest Repository ──
export const createBookingRequestRepository = (models) => ({
  findAll: (where = {}, options = {}) => models.BookingRequest.findAll({
    where,
    include: [
      { model: models.Booking, as: 'booking' },
      { model: models.User, as: 'user' },
    ],
    ...options,
  }),
  findById: (id) => models.BookingRequest.findByPk(id, {
    include: [
      { model: models.Booking, as: 'booking' },
      { model: models.User, as: 'user' },
    ],
  }),
  create: (data) => models.BookingRequest.create(data),
  update: (id, data) => models.BookingRequest.update(data, { where: { id } }),
  findByBookingId: (bookingId) => models.BookingRequest.findAll({ where: { bookingId }, order: [['createdAt', 'DESC']] }),
  findByUserId: (userId) => models.BookingRequest.findAll({
    where: { userId },
    include: [{ model: models.Booking, as: 'booking' }],
    order: [['createdAt', 'DESC']],
  }),
});

// ── BlockedCustomer Repository ──
export const createBlockedCustomerRepository = (models) => ({
  findAll: (where = {}, options = {}) => models.BlockedCustomer.findAll({ where, ...options }),
  findById: (id) => models.BlockedCustomer.findByPk(id),
  findByPhone: (phone) => models.BlockedCustomer.findOne({ where: { phone } }),
  create: (data) => models.BlockedCustomer.create(data),
  update: (id, data) => models.BlockedCustomer.update(data, { where: { id } }),
  delete: (id) => models.BlockedCustomer.destroy({ where: { id } }),
  isBlocked: async (phone) => {
    const record = await models.BlockedCustomer.findOne({ where: { phone } });
    if (!record) return false;
    if (record.isPermanent) return true;
    if (record.expiresAt && new Date(record.expiresAt) > new Date()) return true;
    return false;
  },
});

/**
 * Create all repositories for a tenant.
 * @param {Object} models - The tenant's models (from req.models)
 * @returns {Object} All repository instances
 */
export function createRepositories(models) {
  return {
    adminRepo: createAdminRepository(models),
    bookingRepo: createBookingRepository(models),
    slotRepo: createSlotRepository(models),
    settingsRepo: createSettingsRepository(models),
    reviewRepo: createReviewRepository(models),
    galleryRepo: createGalleryRepository(models),
    contactRepo: createContactRepository(models),
    statusHistoryRepo: createBookingStatusHistoryRepository(models),
    auditLogRepo: createAuditLogRepository(models),
    slotLockRepo: createSlotLockRepository(models),
    userRepo: createUserRepository(models),
    otpRepo: createOtpRepository(models),
    bookingRequestRepo: createBookingRequestRepository(models),
    blockedCustomerRepo: createBlockedCustomerRepository(models),
  };
}
