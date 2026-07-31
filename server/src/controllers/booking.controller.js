import { bookingSchema } from '../../validators/booking.validator.js';
import { Op } from 'sequelize';
import sendSMS from '../utils/sms.js';
import { normalizePhone } from '../utils/phone.js';
import { sanitizeFields } from '../utils/sanitize.js';

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

// Helper to calculate price based on slots and date type
const calculatePrice = async (settingsRepo, slotRepo, dateStr, startTime, endTime) => {
  const settings = await settingsRepo.getOrCreate();
  const pricing = settings.pricing || {
    weekdayDay: 1500, weekdayNight: 1500,
    weekendDay: 1500, weekendNight: 1500,
    holidayDay: 1500, holidayNight: 1500,
  };

  const bookingDate = new Date(dateStr);
  const dateString = dateStr.split('T')[0];
  const day = bookingDate.getUTCDay();

  let dayType = 'weekday';
  const holidays = settings.holidays || [];
  const weekendDays = settings.weekendDays || [];
  if (holidays.includes(dateString)) {
    dayType = 'holiday';
  } else if (weekendDays.includes(day)) {
    dayType = 'weekend';
  }

  // Hierarchical slot lookup
  let activeSlots = await slotRepo.findAll({ specificDate: dateString, isActive: true }, { order: [['startTime', 'ASC']] });
  if (activeSlots.length === 0) {
    activeSlots = await slotRepo.findAll({ dayOfWeek: day, specificDate: null, isActive: true }, { order: [['startTime', 'ASC']] });
  }
  if (activeSlots.length === 0) {
    activeSlots = await slotRepo.findAll({ dayOfWeek: -1, specificDate: null, isActive: true }, { order: [['startTime', 'ASC']] });
  }

  const overlappingSlots = activeSlots.filter(slot => slot.startTime >= startTime && slot.endTime <= endTime);

  let totalPrice = 0;
  if (overlappingSlots.length > 0) {
    for (const slot of overlappingSlots) {
      const rateType = slot.rateType || 'day';
      if (dayType === 'holiday') {
        totalPrice += rateType === 'night' ? (pricing.holidayNight || 1500) : (pricing.holidayDay || 1500);
      } else if (dayType === 'weekend') {
        totalPrice += rateType === 'night' ? (pricing.weekendNight || 1500) : (pricing.weekendDay || 1500);
      } else {
        totalPrice += rateType === 'night' ? (pricing.weekdayNight || 1500) : (pricing.weekdayDay || 1500);
      }
    }
  } else {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const duration = (eh * 60 + em - (sh * 60 + sm)) / 60;
    const rate = dayType === 'holiday'
      ? (pricing.holidayDay || 1500)
      : dayType === 'weekend'
      ? (pricing.weekendDay || 1500)
      : (pricing.weekdayDay || 1500);
    totalPrice = duration * rate;
  }

  return totalPrice;
};

// Helper to check for double bookings
const checkDoubleBooking = async (bookingRepo, dateStr, startTime, endTime, transaction = null) => {
  const dateString = dateStr.split('T')[0];
  const overlaps = await bookingRepo.findOverlapping(dateString, startTime, endTime, { transaction });
  return overlaps.length > 0;
};

// Public Booking Creation (with transaction)
export const createBooking = async (req, res, next) => {
  const t = await req.tenantDb.transaction();
  const { bookingRepo, settingsRepo, slotRepo, statusHistoryRepo, blockedCustomerRepo } = req.repos;
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
    const todayString = new Date().toISOString().split('T')[0];

    if (dateString < todayString) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot book slots in the past.',
      });
    }

    const isBooked = await checkDoubleBooking(bookingRepo, data.bookingDate, data.startTime, data.endTime, t);
    if (isBooked) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'The selected time slot is already booked. Please choose another slot.',
      });
    }

    const calculatedPrice = await calculatePrice(settingsRepo, slotRepo, data.bookingDate, data.startTime, data.endTime);
    const bookingId = await generateBookingId(bookingRepo);

    // If customer is logged in, associate their userId
    const userId = req.user ? req.user.id : null;

    const booking = await bookingRepo.create({
      ...data,
      phone: normalizedPhone,
      bookingDate: dateString,
      bookingId,
      price: calculatedPrice,
      status: 'Pending',
      userId,
    }, { transaction: t });

    await statusHistoryRepo.create({
      bookingId: booking.id,
      newStatus: 'Pending',
      previousStatus: null,
      changedBy: 'customer',
      reason: 'Initial booking request by customer',
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

// Admin: Get bookings with pagination, search, filter
export const getBookings = async (req, res, next) => {
  try {
    const { bookingRepo } = req.repos;
    const { page = 1, limit = 10, search = '', status = '', sport = '', startDate = '', endDate = '', sort = '-createdAt' } = req.query;

    const where = {};

    if (status) where.status = status;
    if (sport) where.sport = sport;
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
      offset: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
    });

    // Map to match old response format (add _id alias) and inject suspicious history
    const mapped = [];
    for (const b of bookings) {
      const plain = b.toJSON();
      plain._id = plain.id;
      
      let hasSuspiciousHistory = false;
      let suspiciousReason = '';
      
      if (plain.userId) {
        const suspiciousRequest = await req.tenantDb.models.BookingRequest.findOne({
          where: { userId: plain.userId, isSuspicious: true }
        });
        if (suspiciousRequest) {
          hasSuspiciousHistory = true;
          suspiciousReason = suspiciousRequest.suspiciousReason || 'Flagged for rapid booking actions';
        }
      } else if (plain.phone) {
        const local = plain.phone.replace(/^88/, '');
        const suspiciousRequest = await req.tenantDb.models.BookingRequest.findOne({
          where: { isSuspicious: true },
          include: [{
            model: req.tenantDb.models.Booking,
            as: 'booking',
            where: {
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
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const { bookingRepo } = req.repos;
    const booking = await bookingRepo.findById(req.params.id);
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
  const t = await req.tenantDb.transaction();
  const { bookingRepo, settingsRepo, slotRepo, statusHistoryRepo } = req.repos;
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

    const isBooked = await checkDoubleBooking(bookingRepo, data.bookingDate, data.startTime, data.endTime, t);
    if (isBooked) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'This slot is already booked.' });
    }

    const calculatedPrice = await calculatePrice(settingsRepo, slotRepo, data.bookingDate, data.startTime, data.endTime);
    const bookingId = await generateBookingId(bookingRepo);

    const booking = await bookingRepo.create({
      ...data,
      bookingDate: dateString,
      bookingId,
      price: calculatedPrice,
      status: 'Confirmed',
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

    // Check double booking if slot is changing
    if (req.body.bookingDate || req.body.startTime || req.body.endTime) {
      const bDate = updateData.bookingDate || booking.bookingDate;
      const sTime = updateData.startTime || booking.startTime;
      const eTime = updateData.endTime || booking.endTime;

      // Check overlaps excluding current booking ID
      const dateString = bDate.split('T')[0];
      const overlaps = await bookingRepo.findOverlapping(dateString, sTime, eTime);
      const otherOverlaps = overlaps.filter(o => o.id !== booking.id);
      if (otherOverlaps.length > 0) {
        return res.status(400).json({ success: false, message: 'The selected slots are already booked by another reservation.' });
      }

      updateData.price = await calculatePrice(settingsRepo, slotRepo, bDate, sTime, eTime);
    }

    await booking.update(updateData);

    // Create Audit Log
    await auditLogRepo.create({
      userId: req.admin?.id || null,
      action: 'UPDATE_BOOKING',
      entity: 'Booking',
      entityId: booking.id,
      oldValue: oldValues,
      newValue: booking.toJSON(),
      ipAddress: req.ip,
    });

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
    const { bookingRepo, statusHistoryRepo, auditLogRepo } = req.repos;
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
    await auditLogRepo.create({
      userId: req.admin?.id || null,
      action: 'UPDATE_BOOKING_STATUS',
      entity: 'Booking',
      entityId: booking.id,
      oldValue: oldValues,
      newValue: booking.toJSON(),
      ipAddress: req.ip,
    });

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

export const deleteBooking = async (req, res, next) => {
  try {
    const { bookingRepo, auditLogRepo } = req.repos;
    const { id } = req.params;
    const booking = await bookingRepo.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const oldValues = booking.toJSON();
    await booking.destroy();

    // Create Audit Log
    await auditLogRepo.create({
      userId: req.admin?.id || null,
      action: 'DELETE_BOOKING',
      entity: 'Booking',
      entityId: booking.id,
      oldValue: oldValues,
      newValue: null,
      ipAddress: req.ip,
    });

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
    const { bookingRepo } = req.repos;
    const { date, startDate, endDate } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];

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
    });
    const selectedDateRevenue = await bookingRepo.sumPrice({
      status: 'Completed',
      bookingDate: { [Op.gte]: rangeStart, [Op.lte]: rangeEnd },
    });
    const selectedDateOccupancy = Math.round((selectedDateCount / (14 * diffDays)) * 100);

    // Tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Month boundaries
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const todayCount = await bookingRepo.countAll({ bookingDate: todayStr });
    const tomorrowCount = await bookingRepo.countAll({ bookingDate: tomorrowStr });
    const upcomingCount = await bookingRepo.countAll({
      bookingDate: { [Op.gte]: todayStr },
      status: { [Op.in]: ['Pending', 'Confirmed'] },
    });
    const monthlyCount = await bookingRepo.countAll({
      bookingDate: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
    });
    const completedCount = await bookingRepo.countAll({ status: 'Completed' });
    const cancelledCount = await bookingRepo.countAll({ status: 'Cancelled' });

    // Recent bookings
    let recentBookings;
    if (startDate || endDate || date) {
      recentBookings = await bookingRepo.findAll(
        { bookingDate: { [Op.gte]: rangeStart, [Op.lte]: rangeEnd } },
        { order: [['createdAt', 'DESC']] }
      );
    } else {
      recentBookings = await bookingRepo.findAll({}, {
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

    // Weekly stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
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
