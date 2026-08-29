import { bookingSchema } from '../../validators/booking.validator.js';
import { Op } from 'sequelize';
import sendSMS from '../utils/sms.js';
import { normalizePhone } from '../utils/phone.js';
import { sanitizeFields } from '../utils/sanitize.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { sequelize } from '../config/db.js';
import { parsePagination, paginationMeta } from '../utils/paginate.js';
import { getDhakaDateTime as getBangladeshDateTime, dhakaDateOffset, dhakaMonthBounds } from '../utils/timezone.js';
import { assertSameBusiness } from '../utils/validateSameBusiness.js';

// Helper: format 24h time to 12h
const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${m} ${ampm}`;
};

// Helper to generate unique booking reference: IND-YYYY-XXXX
const generateBookingId = async (bookingRepo) => {
  const year = new Date().getFullYear();
  const prefix = `IND-${year}-`;
  const count = await bookingRepo.countWithPrefix(prefix);
  const serial = String(count + 1).padStart(4, '0');
  return `${prefix}${serial}`;
};

const getSlotPriceForDate = (settings, dateString, startTime, slotRateType) => {
  const parts = dateString.split('-');
  const localDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const dayOfWeek = localDate.getDay();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[dayOfWeek];

  const holidays = settings.holidays || [];
  const weekendDays = settings.weekendDays || ['Friday', 'Saturday'];

  const isHoliday = holidays.includes(dateString);
  const isWeekend = weekendDays.some(w => {
    if (typeof w === 'number') return w === dayOfWeek;
    if (typeof w === 'string') return w.toLowerCase() === dayName.toLowerCase() || Number(w) === dayOfWeek;
    return false;
  });

  let isNightShift = slotRateType === 'night';
  if (!slotRateType && startTime) {
    const dayShiftEnd = settings.dayShiftEnd || '16:00';
    isNightShift = startTime >= dayShiftEnd;
  }

  const p = settings.pricing || {};

  if (isHoliday) {
    if (isNightShift) {
      return Number(settings.holidayNightRate || settings.holidayNight || p.holidayNight || settings.nightRate || 3000);
    }
    return Number(settings.holidayDayRate || settings.holidayDay || p.holidayDay || settings.dayRate || 2500);
  }

  if (isWeekend) {
    if (isNightShift) {
      return Number(settings.weekendNightRate || settings.weekendNight || p.weekendNight || settings.nightRate || 2500);
    }
    return Number(settings.weekendDayRate || settings.weekendDay || p.weekendDay || settings.dayRate || 2000);
  }

  // Weekday
  if (isNightShift) {
    return Number(settings.weekdayNightRate || settings.weekdayNight || p.weekdayNight || settings.nightRate || 2000);
  }
  return Number(settings.weekdayDayRate || settings.weekdayDay || p.weekdayDay || settings.dayRate || 1500);
};

// Helper to calculate price based on slots and date type
const calculatePrice = async (settingsRepo, slotRepo, dateStr, startTime, endTime, groundId) => {
  const settings = await settingsRepo.getOrCreate();
  const dateString = dateStr.split('T')[0];

  const parts = dateString.split('-');
  const localDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const dayOfWeek = localDate.getDay();

  // Hierarchical slot lookup filtered by groundId
  let activeSlots = await slotRepo.findAll({ specificDate: dateString, groundId, isActive: true }, { order: [['startTime', 'ASC']] });
  if (activeSlots.length === 0) {
    activeSlots = await slotRepo.findAll({ dayOfWeek, specificDate: null, groundId, isActive: true }, { order: [['startTime', 'ASC']] });
  }
  if (activeSlots.length === 0) {
    activeSlots = await slotRepo.findAll({ dayOfWeek: -1, specificDate: null, groundId, isActive: true }, { order: [['startTime', 'ASC']] });
  }

  const overlappingSlots = activeSlots.filter(slot => slot.startTime >= startTime && slot.endTime <= endTime);

  let totalPrice = 0;
  if (overlappingSlots.length > 0) {
    for (const slot of overlappingSlots) {
      let slotPrice = Number(slot.price);
      if (!slotPrice || slotPrice <= 0) {
        slotPrice = getSlotPriceForDate(settings, dateString, slot.startTime, slot.rateType);
      }
      totalPrice += slotPrice;
    }
  } else {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const duration = (eh * 60 + em - (sh * 60 + sm)) / 60;
    const rate = getSlotPriceForDate(settings, dateString, startTime, 'day');
    totalPrice = duration * rate;
  }

  return totalPrice;
};

// Helper to check for double bookings specifically on a ground
const checkDoubleBooking = async (bookingRepo, dateStr, startTime, endTime, groundId, transaction = null) => {
  const dateString = dateStr.split('T')[0];
  const overlaps = await bookingRepo.findOverlapping(dateString, startTime, endTime, groundId, { transaction });
  return overlaps.length > 0;
};

// Public Booking Creation (with transaction)
export const createBooking = async (req, res, next) => {
  const t = await sequelize.transaction();
  const { bookingRepo, settingsRepo, slotRepo, statusHistoryRepo, blockedCustomerRepo, groundRepo } = req.repos;
  try {
    const validation = bookingSchema.safeParse(req.body);
    if (!validation.success) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const data = sanitizeFields(validation.data, ['customerName', 'notes', 'email']);
    const normalizedPhone = normalizePhone(data.phone);

    // Check if customer phone number is blacklisted/blocked
    const isBlocked = await blockedCustomerRepo.isBlocked(normalizedPhone);
    if (isBlocked) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: 'This phone number has been suspended from making reservations. Please contact our support team.',
      });
    }

    const dateString = data.bookingDate.split('T')[0];
    const { dateString: todayString, timeString: currentTime } = getBangladeshDateTime();

    if (dateString < todayString) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot book slots in the past.',
      });
    }

    if (dateString === todayString && data.startTime < currentTime) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot book slots that have already started or passed today.',
      });
    }

    let targetGroundId = data.groundId ? Number(data.groundId) : null;
    if (!targetGroundId) {
      const firstGround = await groundRepo.findAll({}, { limit: 1 });
      if (firstGround && firstGround.length > 0) {
        targetGroundId = firstGround[0].id;
      } else {
        targetGroundId = 1;
      }
    } else {
      // Cross-business FK integrity (constitution Principle III): a client
      // may not book a ground belonging to another business.
      await assertSameBusiness(req.models.Ground, targetGroundId, req.businessId, 'groundId');
    }

    const isBooked = await checkDoubleBooking(bookingRepo, data.bookingDate, data.startTime, data.endTime, targetGroundId, t);
    if (isBooked) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'The selected time slot is already booked. Please choose another slot.',
      });
    }

    const calculatedPrice = await calculatePrice(settingsRepo, slotRepo, data.bookingDate, data.startTime, data.endTime, targetGroundId);
    const bookingId = await generateBookingId(bookingRepo);

    // If customer is logged in, associate their userId
    const userId = req.user ? req.user.id : null;

    // Check Admin Payment Configuration
    const settings = await settingsRepo.get();
    let pConfig = settings?.paymentConfig || { enabled: false };
    if (typeof pConfig === 'string') {
      try { pConfig = JSON.parse(pConfig); } catch (e) { pConfig = { enabled: false }; }
    }
    const isPaymentGatewayAllowed = settings?.allowPaymentGateway !== false;
    const isPaymentEnabled = isPaymentGatewayAllowed && !!pConfig.enabled;

    let payableAmount = 0;
    let dueAmount = calculatedPrice;

    if (isPaymentEnabled) {
      if (pConfig.type === 'full') {
        payableAmount = calculatedPrice;
        dueAmount = 0;
      } else if (pConfig.type === 'partial') {
        if (pConfig.partialType === 'fixed') {
          payableAmount = Math.min(calculatedPrice, Number(pConfig.partialFixedAmount || 500));
        } else {
          const pct = Math.min(100, Math.max(1, Number(pConfig.partialPercentage || 50)));
          payableAmount = Math.round((calculatedPrice * pct) / 100);
        }
        dueAmount = Math.max(0, calculatedPrice - payableAmount);
      }
    }

    const initialStatus = isPaymentEnabled ? 'PaymentPending' : 'Pending';

    const booking = await bookingRepo.create({
      ...data,
      phone: normalizedPhone,
      bookingDate: dateString,
      bookingId,
      price: calculatedPrice,
      status: initialStatus,
      userId,
      groundId: targetGroundId,
      paymentStatus: 'unpaid',
      paidAmount: 0,
      dueAmount: calculatedPrice,
    }, { transaction: t });

    await statusHistoryRepo.create({
      bookingId: booking.id,
      newStatus: initialStatus,
      previousStatus: null,
      changedBy: 'customer',
      reason: isPaymentEnabled ? 'Initial booking created awaiting gateway online payment' : 'Initial booking request by customer',
    }, { transaction: t });

    await t.commit();

    // Only broadcast slot reservation if payment system is disabled
    if (!isPaymentEnabled) {
      const io = req.app.get('io');
      if (io) {
        io.emit('slot-status-changed', { date: dateString });
        io.emit('new-booking', booking);
      }
    }

    const plain = booking.toJSON ? booking.toJSON() : booking;
    plain._id = plain.id;

    res.status(201).json({
      success: true,
      booking: plain,
      paymentRequired: isPaymentEnabled,
      payableAmount: isPaymentEnabled ? payableAmount : 0,
      dueAmount: isPaymentEnabled ? dueAmount : calculatedPrice,
      paymentConfig: isPaymentEnabled ? pConfig : null,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// Admin: Get bookings with pagination, search, filter
export const getBookings = async (req, res, next) => {
  try {
    const { bookingRepo } = req.repos;
    const { search = '', status = '', sport = '', startDate = '', endDate = '', sort = '-createdAt', groundId } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const where = {};

    if (status) where.status = status;
    if (sport) where.sport = sport;
    if (groundId) {
      if (typeof groundId === 'string' && groundId.includes(',')) {
        const ids = groundId.split(',').map(id => Number(id.trim())).filter(Boolean);
        where.groundId = { [Op.in]: ids };
      } else if (Array.isArray(groundId)) {
        where.groundId = { [Op.in]: groundId.map(Number) };
      } else {
        where.groundId = Number(groundId);
      }
    }
    if (search) {
      where[Op.or] = [
        { customerName: { [Op.like]: `%${search}%` } },
        { bookingId: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }
    if (startDate || endDate) {
      where.bookingDate = {};
      if (startDate) where.bookingDate[Op.gte] = startDate.split('T')[0];
      if (endDate) where.bookingDate[Op.lte] = endDate.split('T')[0];
    }

    // Parse sort
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortDir = sort.startsWith('-') ? 'DESC' : 'ASC';

    const { count: total, rows: bookings } = await bookingRepo.findAndCountAll(where, {
      order: [[sortField, sortDir]],
      offset,
      limit,
      include: [{ model: req.models.Ground, as: 'ground' }]
    });

    // Map to match old response format (add _id alias) and inject suspicious history
    const mapped = [];
    for (const b of bookings) {
      const plain = b.toJSON();
      plain._id = plain.id;
      
      let hasSuspiciousHistory = false;
      let suspiciousReason = '';
      
      if (plain.userId) {
        const suspiciousRequest = await req.models.BookingRequest.findOne({
          where: { businessId: req.businessId, userId: plain.userId, isSuspicious: true }
        });
        if (suspiciousRequest) {
          hasSuspiciousHistory = true;
          suspiciousReason = suspiciousRequest.suspiciousReason || 'Flagged for rapid booking actions';
        }
      } else if (plain.phone) {
        const local = plain.phone.replace(/^88/, '');
        const suspiciousRequest = await req.models.BookingRequest.findOne({
          where: { businessId: req.businessId, isSuspicious: true },
          include: [{
            model: req.models.Booking,
            as: 'booking',
            where: {
              businessId: req.businessId,
              phone: [plain.phone, local]
            }
          }]
        });
        if (suspiciousRequest) {
          hasSuspiciousHistory = true;
          suspiciousReason = suspiciousRequest.suspiciousReason || 'Flagged for rapid booking actions';
        }
      }
      
      plain.hasSuspiciousHistory = hasSuspiciousHistory;
      plain.suspiciousReason = suspiciousReason;
      mapped.push(plain);
    }

    res.status(200).json({
      success: true,
      bookings: mapped,
      pagination: paginationMeta(total, { page, limit }),
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const { bookingRepo } = req.repos;
    const param = req.params.id;
    let booking = null;

    if (!isNaN(Number(param))) {
      booking = await bookingRepo.findById(Number(param), {
        include: [{ model: req.models.Ground, as: 'ground' }]
      });
    }

    if (!booking) {
      const all = await bookingRepo.findAll({ bookingId: param }, {
        include: [{ model: req.models.Ground, as: 'ground' }]
      });
      if (all && all.length > 0) {
        booking = all[0];
      }
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const plain = booking.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, booking: plain });
  } catch (error) {
    next(error);
  }
};

export const createManualBooking = async (req, res, next) => {
  const t = await sequelize.transaction();
  const { bookingRepo, settingsRepo, slotRepo, statusHistoryRepo, groundRepo } = req.repos;
  try {
    const validation = bookingSchema.safeParse(req.body);
    if (!validation.success) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const data = validation.data;
    const dateString = data.bookingDate.split('T')[0];

    let targetGroundId = data.groundId ? Number(data.groundId) : null;
    if (!targetGroundId) {
      const firstGround = await groundRepo.findAll({}, { limit: 1 });
      if (firstGround && firstGround.length > 0) {
        targetGroundId = firstGround[0].id;
      } else {
        targetGroundId = 1;
      }
    } else {
      // Cross-business FK integrity (constitution Principle III): a client
      // may not book a ground belonging to another business.
      await assertSameBusiness(req.models.Ground, targetGroundId, req.businessId, 'groundId');
    }

    const isBooked = await checkDoubleBooking(bookingRepo, data.bookingDate, data.startTime, data.endTime, targetGroundId, t);
    if (isBooked) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'This slot is already booked.' });
    }

    const calculatedPrice = await calculatePrice(settingsRepo, slotRepo, data.bookingDate, data.startTime, data.endTime, targetGroundId);
    const bookingId = await generateBookingId(bookingRepo);

    const paidAmountNum = req.body.paidAmount !== undefined ? Number(req.body.paidAmount) : calculatedPrice;
    const paymentStatusVal = req.body.paymentStatus || (paidAmountNum >= calculatedPrice ? 'paid' : paidAmountNum > 0 ? 'partial' : 'unpaid');
    const paymentGatewayVal = req.body.paymentMethod || 'Cash';
    const dueAmountNum = Math.max(0, calculatedPrice - paidAmountNum);

    const booking = await bookingRepo.create({
      ...data,
      bookingDate: dateString,
      bookingId,
      price: calculatedPrice,
      status: 'Confirmed',
      groundId: targetGroundId,
      paymentStatus: paymentStatusVal,
      paymentGateway: paymentGatewayVal,
      paidAmount: paidAmountNum,
      dueAmount: dueAmountNum,
      transactionId: req.body.transactionId || null,
    }, { transaction: t });

    await statusHistoryRepo.create({
      bookingId: booking.id,
      newStatus: 'Confirmed',
      previousStatus: null,
      changedBy: `admin:${req.admin?.username || 'admin'}`,
      reason: 'Manual booking created by admin',
    }, { transaction: t });

    await t.commit();

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: dateString });
      io.emit('new-booking', booking);
    }

    res.status(201).json({ success: true, booking });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

export const updateBooking = async (req, res, next) => {
  try {
    const { bookingRepo, settingsRepo, slotRepo, auditLogRepo } = req.repos;
    const { id } = req.params;
    const booking = await bookingRepo.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const updateData = { ...req.body };
    const oldValues = booking.toJSON();

    if (updateData.bookingDate) {
      updateData.bookingDate = updateData.bookingDate.split('T')[0];
    }

    // Check double booking if slot or ground is changing
    if (req.body.bookingDate || req.body.startTime || req.body.endTime || req.body.groundId) {
      const bDate = updateData.bookingDate || booking.bookingDate;
      const sTime = updateData.startTime || booking.startTime;
      const eTime = updateData.endTime || booking.endTime;
      const gId = updateData.groundId !== undefined ? Number(updateData.groundId) : booking.groundId;

      // Cross-business FK integrity (constitution Principle III): a client
      // may not repoint this booking at another business's ground.
      if (updateData.groundId !== undefined) {
        await assertSameBusiness(req.models.Ground, gId, req.businessId, 'groundId');
      }

      // Check overlaps excluding current booking ID
      const dateString = bDate.split('T')[0];
      const overlaps = await bookingRepo.findOverlapping(dateString, sTime, eTime, gId);
      const otherOverlaps = overlaps.filter(o => o.id !== booking.id);
      if (otherOverlaps.length > 0) {
        return res.status(400).json({ success: false, message: 'The selected slots are already booked by another reservation.' });
      }

      updateData.price = await calculatePrice(settingsRepo, slotRepo, bDate, sTime, eTime, gId);
    }

    await booking.update(updateData);

    // Create Audit Log
    createAuditLog(req, {
      action: 'UPDATE_BOOKING',
      category: 'bookings',
      entity: 'Booking',
      entityId: booking.id,
      description: `Updated booking details for #${booking.bookingId || booking.id} (${booking.name || 'Customer'})`,
      oldValue: oldValues,
      newValue: booking.toJSON ? booking.toJSON() : booking,
    }).catch(err => console.error(err));

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate });
      io.emit('booking-updated', booking);
    }

    const plain = booking.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, booking: plain });
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  try {
    const { bookingRepo, statusHistoryRepo } = req.repos;
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const booking = await bookingRepo.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const previousStatus = booking.status;
    const oldValues = booking.toJSON();

    await booking.update({ status });

    await statusHistoryRepo.create({
      bookingId: booking.id,
      newStatus: status,
      previousStatus,
      changedBy: req.admin ? `admin:${req.admin.username}` : 'system',
      reason: reason || 'Status updated by admin',
    });

    // Create Audit Log
    createAuditLog(req, {
      action: 'UPDATE_BOOKING_STATUS',
      category: 'bookings',
      entity: 'Booking',
      entityId: booking.id,
      description: `Changed booking status for #${booking.bookingId || booking.id} (${booking.name || 'Customer'}) to '${status}'`,
      oldValue: oldValues,
      newValue: booking.toJSON ? booking.toJSON() : booking,
    }).catch(err => console.error(err));

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate });
      io.emit('booking-updated', booking);
    }

    // ── SMS notification when booking is Confirmed ──
    if (status === 'Confirmed' && booking.phone) {
      try {
        const settings = await req.repos.settingsRepo.get();
        const venueName = settings?.businessName || 'Indoor Arena';
        const smsMessage = `[${venueName}] Your booking ${booking.bookingId} is CONFIRMED!\nDate: ${booking.bookingDate}\nTime: ${fmt12(booking.startTime)} - ${fmt12(booking.endTime)}\nSport: ${booking.sport}\nPrice: ৳${booking.price}\nThank you for choosing ${venueName}!`;
        sendSMS(booking.phone, smsMessage).catch(err => console.error('[SMS] Booking confirmation failed:', err.message));
      } catch (smsErr) {
        console.error('[SMS] Error sending confirmation:', smsErr.message);
      }
    }

    const plain = booking.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, booking: plain });
  } catch (error) {
    next(error);
  }
};

export const processBookingRefund = async (req, res, next) => {
  try {
    const { bookingRepo, statusHistoryRepo, settingsRepo } = req.repos;
    const { id } = req.params;
    const { refundAmount, refundReason } = req.body;

    const booking = await bookingRepo.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const amountToRefund = Number(refundAmount) || Number(booking.paidAmount) || 0;
    const oldValues = booking.toJSON();

    await booking.update({
      status: 'Cancelled',
      paymentStatus: 'refunded',
      paymentDetails: {
        ...(booking.paymentDetails || {}),
        refundAmount: amountToRefund,
        refundReason: refundReason || 'Requested by customer / Cancelled by Admin',
        refundedAt: new Date(),
      },
    });

    await statusHistoryRepo.create({
      bookingId: booking.id,
      newStatus: 'Cancelled',
      previousStatus: booking.status,
      changedBy: req.admin ? `admin:${req.admin.username}` : 'admin',
      reason: `Refund Issued: ৳${amountToRefund} (${refundReason || 'Slot cancelled & refunded'})`,
    });

    createAuditLog(req, {
      action: 'PROCESS_REFUND',
      category: 'bookings',
      entity: 'Booking',
      entityId: booking.id,
      description: `Issued refund of ৳${amountToRefund} for booking #${booking.bookingId || booking.id}. Reason: ${refundReason || 'Slot cancelled'}`,
      oldValue: oldValues,
      newValue: booking.toJSON ? booking.toJSON() : booking,
    }).catch(err => console.error(err));

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate });
      io.emit('booking-updated', booking);
    }

    if (booking.phone) {
      try {
        const settings = await settingsRepo.get();
        const venueName = settings?.businessName || 'Indoor Arena';
        const smsMessage = `[${venueName}] Refund Issued! Your booking ${booking.bookingId} has been cancelled & refunded (৳${amountToRefund}).`;
        sendSMS(booking.phone, smsMessage).catch(err => console.error('[SMS] Refund notification failed:', err.message));
      } catch (smsErr) {}
    }

    const plain = booking.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, message: 'Refund processed & booking cancelled successfully!', booking: plain });
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (req, res, next) => {
  try {
    const { bookingRepo } = req.repos;
    const { id } = req.params;
    const booking = await bookingRepo.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const oldValues = booking.toJSON();
    await booking.destroy();

    // Create Audit Log
    createAuditLog(req, {
      action: 'DELETE_BOOKING',
      category: 'bookings',
      entity: 'Booking',
      entityId: booking.id,
      description: `Deleted booking #${booking.bookingId || booking.id} (${booking.name || 'Customer'})`,
      oldValue: oldValues,
    }).catch(err => console.error(err));

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate });
      io.emit('booking-deleted', { id: booking.id });
    }

    res.status(200).json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Dashboard analytics
export const getDashboardData = async (req, res, next) => {
  try {
    const { bookingRepo, financeRepo } = req.repos;
    const { date, startDate, endDate, groundId } = req.query;
    const todayStr = getBangladeshDateTime().dateString;

    // Build optional ground filter
    const gFilter = {};
    const finFilter = {};
    if (groundId) {
      if (typeof groundId === 'string' && groundId.includes(',')) {
        const ids = groundId.split(',').map(id => Number(id.trim())).filter(Boolean);
        gFilter.groundId = { [Op.in]: ids };
        finFilter.groundId = { [Op.in]: ids };
      } else {
        gFilter.groundId = Number(groundId);
        finFilter.groundId = Number(groundId);
      }
    }

    const totalInvestments = financeRepo ? await financeRepo.sumEntries('investment', finFilter) : 0;
    const totalExpenses = financeRepo ? await financeRepo.sumEntries('expense', finFilter) : 0;

    let rangeStart = todayStr;
    let rangeEnd = todayStr;

    if (startDate && endDate) {
      rangeStart = startDate.split('T')[0];
      rangeEnd = endDate.split('T')[0];
    } else if (date) {
      rangeStart = date.split('T')[0];
      rangeEnd = date.split('T')[0];
    }

    // Calculate date diffs for occupancy
    const diffMs = Math.abs(new Date(rangeEnd) - new Date(rangeStart));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) || 1;

    const selectedDateCount = await bookingRepo.countAll({
      bookingDate: { [Op.gte]: rangeStart, [Op.lte]: rangeEnd },
      ...gFilter,
    });
    const selectedDateRevenue = await bookingRepo.sumPrice({
      status: 'Completed',
      bookingDate: { [Op.gte]: rangeStart, [Op.lte]: rangeEnd },
      ...gFilter,
    });
    const selectedDateOccupancy = Math.round((selectedDateCount / (14 * diffDays)) * 100);

    // Tomorrow (Asia/Dhaka local)
    const tomorrowStr = dhakaDateOffset(1);

    // Month boundaries (Asia/Dhaka local)
    const { startOfMonth, endOfMonth } = dhakaMonthBounds();

    const todayCount = await bookingRepo.countAll({ bookingDate: todayStr, ...gFilter });
    const tomorrowCount = await bookingRepo.countAll({ bookingDate: tomorrowStr, ...gFilter });
    const upcomingCount = await bookingRepo.countAll({
      bookingDate: { [Op.gte]: todayStr },
      status: { [Op.in]: ['Pending', 'Confirmed'] },
      ...gFilter,
    });
    const monthlyCount = await bookingRepo.countAll({
      bookingDate: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
      ...gFilter,
    });
    const completedCount = await bookingRepo.countAll({ status: 'Completed', ...gFilter });
    const cancelledCount = await bookingRepo.countAll({ status: 'Cancelled', ...gFilter });

    // Recent bookings
    let recentBookings;
    if (startDate || endDate || date) {
      recentBookings = await bookingRepo.findAll(
        { bookingDate: { [Op.gte]: rangeStart, [Op.lte]: rangeEnd }, ...gFilter },
        { order: [['createdAt', 'DESC']] }
      );
    } else {
      recentBookings = await bookingRepo.findAll({ ...gFilter }, {
        order: [['createdAt', 'DESC']],
        limit: 5,
      });
    }

    // Map _id for backward compat
    const mappedRecent = recentBookings.map(b => {
      const plain = b.toJSON();
      plain._id = plain.id;
      return plain;
    });

    const monthlyRevenue = await bookingRepo.sumPrice({
      status: 'Completed',
      bookingDate: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
    });

    // Weekly stats (Asia/Dhaka local)
    const sevenDaysAgoStr = dhakaDateOffset(-7);
    const weeklyStats = await bookingRepo.getGroupedByDate(sevenDaysAgoStr, todayStr);
    const weeklyMapped = weeklyStats.map(row => ({
      _id: row.bookingDate,
      count: parseInt(row.count),
      revenue: parseInt(row.revenue) || 0,
    }));

    const peakHours = await bookingRepo.getGroupedByStartTime();
    const peakMapped = peakHours.map(row => ({
      _id: row.startTime,
      count: parseInt(row.count),
    }));

    const statusStats = await bookingRepo.getGroupedByStatus();
    const statusMapped = statusStats.map(row => ({
      _id: row.status,
      count: parseInt(row.count),
    }));

    // Occupancy
    const daysInMonth = lastDay;
    const bookingsThisMonth = await bookingRepo.countAll({
      bookingDate: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
      status: { [Op.in]: ['Confirmed', 'Completed'] },
    });
    const totalCapacity = daysInMonth * 14;
    const occupancyRate = totalCapacity > 0 ? Math.round((bookingsThisMonth / totalCapacity) * 100) : 0;

    res.status(200).json({
      success: true,
      metrics: {
        todayBookings: todayCount,
        tomorrowBookings: tomorrowCount,
        upcomingBookings: upcomingCount,
        monthlyBookings: monthlyCount,
        completedBookings: completedCount,
        cancelledBookings: cancelledCount,
        monthlyRevenue,
        occupancyRate,
        selectedDateCount,
        selectedDateRevenue,
        selectedDateOccupancy,
        totalInvestments,
        totalExpenses,
        netBalance: totalInvestments - totalExpenses,
      },
      recentBookings: mappedRecent,
      weeklyStats: mappedRecent, // Fallback mapping
      peakHours: peakMapped,
      statusStats: statusMapped,
    });
  } catch (error) {
    next(error);
  }
};
