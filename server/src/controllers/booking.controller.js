import bookingRepository from '../repositories/booking.repository.js';
import settingsRepository from '../repositories/settings.repository.js';
import slotRepository from '../repositories/slot.repository.js';
import { sequelize } from '../config/db.js';
import { bookingSchema } from '../../validators/booking.validator.js';
import { Op } from 'sequelize';

// Helper to generate unique booking reference: IND-YYYY-XXXX
const generateBookingId = async () => {
  const year = new Date().getFullYear();
  const prefix = `IND-${year}-`;
  const count = await bookingRepository.countWithPrefix(prefix);
  const serial = String(count + 1).padStart(4, '0');
  return `${prefix}${serial}`;
};

// Helper to calculate price based on slots and date type
const calculatePrice = async (dateStr, startTime, endTime) => {
  const settings = await settingsRepository.getOrCreate();
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
  let activeSlots = await slotRepository.findAll({ specificDate: dateString, isActive: true }, { order: [['startTime', 'ASC']] });
  if (activeSlots.length === 0) {
    activeSlots = await slotRepository.findAll({ dayOfWeek: day, specificDate: null, isActive: true }, { order: [['startTime', 'ASC']] });
  }
  if (activeSlots.length === 0) {
    activeSlots = await slotRepository.findAll({ dayOfWeek: -1, specificDate: null, isActive: true }, { order: [['startTime', 'ASC']] });
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
const checkDoubleBooking = async (dateStr, startTime, endTime) => {
  const dateString = dateStr.split('T')[0];
  const overlaps = await bookingRepository.findOverlapping(dateString, startTime, endTime);
  return overlaps.length > 0;
};

// Public Booking Creation (with transaction)
export const createBooking = async (req, res, next) => {
  const t = await sequelize.transaction();
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

    const isBooked = await checkDoubleBooking(data.bookingDate, data.startTime, data.endTime);
    if (isBooked) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'The selected time slot is already booked. Please choose another slot.',
      });
    }

    const calculatedPrice = await calculatePrice(data.bookingDate, data.startTime, data.endTime);
    const bookingId = await generateBookingId();

    const booking = await bookingRepository.create({
      ...data,
      bookingDate: dateString,
      bookingId,
      price: calculatedPrice,
      status: 'Pending',
    }, { transaction: t });

    await bookingRepository.createStatusHistory({
      bookingId: booking.id,
      status: 'Pending',
    });

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

    const { count: total, rows: bookings } = await bookingRepository.findAndCountAll(where, {
      order: [[sortField, sortDir]],
      offset: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
    });

    // Map to match old response format (add _id alias)
    const mapped = bookings.map(b => {
      const plain = b.toJSON();
      plain._id = plain.id;
      return plain;
    });

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
    const booking = await bookingRepository.findById(req.params.id);
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

    const isBooked = await checkDoubleBooking(data.bookingDate, data.startTime, data.endTime);
    if (isBooked) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'This slot is already booked.' });
    }

    const calculatedPrice = await calculatePrice(data.bookingDate, data.startTime, data.endTime);
    const bookingId = await generateBookingId();

    const booking = await bookingRepository.create({
      ...data,
      bookingDate: dateString,
      bookingId,
      price: calculatedPrice,
      status: 'Confirmed',
    }, { transaction: t });

    await bookingRepository.createStatusHistory({
      bookingId: booking.id,
      status: 'Confirmed',
      adminId: req.admin?.id || null,
    });

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
    const { id } = req.params;
    const booking = await bookingRepository.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const updateData = { ...req.body };

    if (updateData.bookingDate) {
      updateData.bookingDate = updateData.bookingDate.split('T')[0];
    }

    if (req.body.bookingDate || req.body.startTime || req.body.endTime) {
      const bDate = updateData.bookingDate || booking.bookingDate;
      const sTime = updateData.startTime || booking.startTime;
      const eTime = updateData.endTime || booking.endTime;
      updateData.price = await calculatePrice(bDate, sTime, eTime);
    }

    await booking.update(updateData);

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate });
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
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const booking = await bookingRepository.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await booking.update({ status });

    await bookingRepository.createStatusHistory({
      bookingId: booking.id,
      status,
      adminId: req.admin?.id || null,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate });
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
    const { id } = req.params;
    const booking = await bookingRepository.delete(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate });
    }

    res.status(200).json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Dashboard analytics
export const getDashboardData = async (req, res, next) => {
  try {
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

    const selectedDateCount = await bookingRepository.countAll({
      bookingDate: { [Op.gte]: rangeStart, [Op.lte]: rangeEnd },
    });
    const selectedDateRevenue = await bookingRepository.sumPrice({
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

    const todayCount = await bookingRepository.countAll({ bookingDate: todayStr });
    const tomorrowCount = await bookingRepository.countAll({ bookingDate: tomorrowStr });
    const upcomingCount = await bookingRepository.countAll({
      bookingDate: { [Op.gte]: todayStr },
      status: { [Op.in]: ['Pending', 'Confirmed'] },
    });
    const monthlyCount = await bookingRepository.countAll({
      bookingDate: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
    });
    const completedCount = await bookingRepository.countAll({ status: 'Completed' });
    const cancelledCount = await bookingRepository.countAll({ status: 'Cancelled' });

    // Recent bookings
    let recentBookings;
    if (startDate || endDate || date) {
      recentBookings = await bookingRepository.findAll(
        { bookingDate: { [Op.gte]: rangeStart, [Op.lte]: rangeEnd } },
        { order: [['createdAt', 'DESC']] }
      );
    } else {
      recentBookings = await bookingRepository.findAll({}, {
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

    const monthlyRevenue = await bookingRepository.sumPrice({
      status: 'Completed',
      bookingDate: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
    });

    // Weekly stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    const weeklyStats = await bookingRepository.getGroupedByDate(sevenDaysAgoStr, todayStr);
    const weeklyMapped = weeklyStats.map(row => ({
      _id: row.bookingDate,
      count: parseInt(row.count),
      revenue: parseInt(row.revenue) || 0,
    }));

    const peakHours = await bookingRepository.getGroupedByStartTime();
    const peakMapped = peakHours.map(row => ({
      _id: row.startTime,
      count: parseInt(row.count),
    }));

    const statusStats = await bookingRepository.getGroupedByStatus();
    const statusMapped = statusStats.map(row => ({
      _id: row.status,
      count: parseInt(row.count),
    }));

    // Occupancy
    const daysInMonth = lastDay;
    const bookingsThisMonth = await bookingRepository.countAll({
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
      weeklyStats: weeklyMapped,
      peakHours: peakMapped,
      statusStats: statusMapped,
    });
  } catch (error) {
    next(error);
  }
};
