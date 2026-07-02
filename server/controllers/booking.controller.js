import Booking from '../models/Booking.js';
import Settings from '../models/Settings.js';
import Slot from '../models/Slot.js';
import { bookingSchema } from '../validators/booking.validator.js';

// Helper to generate unique booking reference: IND-YYYY-XXXX
const generateBookingId = async () => {
  const year = new Date().getFullYear();
  const prefix = `IND-${year}-`;
  const count = await Booking.countDocuments({
    bookingId: { $regex: `^${prefix}` },
  });
  const serial = String(count + 1).padStart(4, '0');
  return `${prefix}${serial}`;
};

// Helper to calculate price based on slots and date type (Weekend, Holiday, Regular)
const calculatePrice = async (dateStr, startTime, endTime) => {
  const settings = await Settings.findOne() || {
    pricing: {
      weekdayDay: 1500,
      weekdayNight: 1500,
      weekendDay: 1500,
      weekendNight: 1500,
      holidayDay: 1500,
      holidayNight: 1500,
    },
  };

  const bookingDate = new Date(dateStr);
  const dateString = dateStr.split('T')[0];
  const day = bookingDate.getUTCDay();

  // Determine day type: 'holiday' | 'weekend' | 'weekday'
  let dayType = 'weekday';
  if (settings.holidays && settings.holidays.includes(dateString)) {
    dayType = 'holiday';
  } else if (settings.weekendDays && settings.weekendDays.includes(day)) {
    dayType = 'weekend';
  }

  // Find all slots for this date category to determine their rateType ('day' or 'night')
  let activeSlots = await Slot.find({ specificDate: dateString, isActive: true });
  if (activeSlots.length === 0) {
    activeSlots = await Slot.find({ dayOfWeek: day, specificDate: null, isActive: true });
  }
  if (activeSlots.length === 0) {
    activeSlots = await Slot.find({ dayOfWeek: -1, specificDate: null, isActive: true });
  }

  // Filter slots overlapping the requested range [startTime, endTime]
  const overlappingSlots = activeSlots.filter(slot => {
    return slot.startTime >= startTime && slot.endTime <= endTime;
  });

  let totalPrice = 0;
  if (overlappingSlots.length > 0) {
    for (const slot of overlappingSlots) {
      const rateType = slot.rateType || 'day';
      const pricing = settings.pricing || {};
      if (dayType === 'holiday') {
        totalPrice += rateType === 'night' ? (pricing.holidayNight || 1500) : (pricing.holidayDay || 1500);
      } else if (dayType === 'weekend') {
        totalPrice += rateType === 'night' ? (pricing.weekendNight || 1500) : (pricing.weekendDay || 1500);
      } else {
        totalPrice += rateType === 'night' ? (pricing.weekdayNight || 1500) : (pricing.weekdayDay || 1500);
      }
    }
  } else {
    // Fallback if no matching slots are found
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const duration = (eh * 60 + em - (sh * 60 + sm)) / 60;
    const pricing = settings.pricing || {};
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
  const queryDate = new Date(dateStr);
  const startOfDay = new Date(queryDate.setUTCHours(0, 0, 0, 0));
  const endOfDay = new Date(queryDate.setUTCHours(23, 59, 59, 999));

  // Find any bookings on that day that are Confirmed or Pending and overlap the requested slot
  const overlaps = await Booking.find({
    bookingDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['Pending', 'Confirmed', 'Completed'] },
    $or: [
      { startTime: { $gte: startTime, $lt: endTime } },
      { endTime: { $gt: startTime, $lte: endTime } },
      { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
    ],
  });

  return overlaps.length > 0;
};

// Public Booking Creation
export const createBooking = async (req, res, next) => {
  try {
    const validation = bookingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const data = validation.data;

    // Check double booking
    const isBooked = await checkDoubleBooking(data.bookingDate, data.startTime, data.endTime);
    if (isBooked) {
      return res.status(400).json({
        success: false,
        message: 'The selected time slot is already booked. Please choose another slot.',
      });
    }

    const calculatedPrice = await calculatePrice(data.bookingDate, data.startTime, data.endTime);
    const bookingId = await generateBookingId();

    const booking = await Booking.create({
      ...data,
      bookingId,
      price: calculatedPrice,
      status: 'Pending',
    });

    // Notify clients about the newly booked slot via socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', {
        date: data.bookingDate.split('T')[0],
      });
    }

    res.status(201).json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

// Admin Endpoints
export const getBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', sport = '', startDate = '', endDate = '', sort = '-createdAt' } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }
    if (sport) {
      query.sport = sport;
    }
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { bookingId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.bookingDate = {};
      if (startDate) {
        query.bookingDate.$gte = new Date(new Date(startDate).setUTCHours(0, 0, 0, 0));
      }
      if (endDate) {
        query.bookingDate.$lte = new Date(new Date(endDate).setUTCHours(23, 59, 59, 999));
      }
    }

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(200).json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

export const createManualBooking = async (req, res, next) => {
  try {
    const validation = bookingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const data = validation.data;
    const isBooked = await checkDoubleBooking(data.bookingDate, data.startTime, data.endTime);
    if (isBooked) {
      return res.status(400).json({
        success: false,
        message: 'This slot is already booked.',
      });
    }

    const calculatedPrice = await calculatePrice(data.bookingDate, data.startTime, data.endTime);
    const bookingId = await generateBookingId();

    const booking = await Booking.create({
      ...data,
      bookingId,
      price: calculatedPrice,
      status: 'Confirmed', // Manual admin bookings start as confirmed
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', {
        date: data.bookingDate.split('T')[0],
      });
    }

    res.status(201).json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

export const updateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Update details (excluding key unique constraint fields if needed, or allowing updates)
    Object.assign(booking, req.body);
    
    // Re-calculate price if date/time range changed
    if (req.body.bookingDate || req.body.startTime || req.body.endTime) {
      const bDate = booking.bookingDate ? booking.bookingDate.toISOString() : new Date().toISOString();
      booking.price = await calculatePrice(bDate, booking.startTime, booking.endTime);
    }

    await booking.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate.toISOString().split('T')[0] });
    }

    res.status(200).json({ success: true, booking });
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

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.status = status;
    await booking.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate.toISOString().split('T')[0] });
    }

    res.status(200).json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByIdAndDelete(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate.toISOString().split('T')[0] });
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
    let startRange = new Date();
    let endRange = new Date();

    if (startDate && endDate) {
      startRange = new Date(startDate);
      endRange = new Date(endDate);
    } else if (date) {
      startRange = new Date(date);
      endRange = new Date(date);
    }

    const startOfRange = new Date(new Date(startRange.toISOString().split('T')[0]).setUTCHours(0, 0, 0, 0));
    const endOfRange = new Date(new Date(endRange.toISOString().split('T')[0]).setUTCHours(23, 59, 59, 999));

    const diffTime = Math.abs(endOfRange - startOfRange);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    // Calculate metrics for selected range
    const selectedDateCount = await Booking.countDocuments({ bookingDate: { $gte: startOfRange, $lte: endOfRange } });
    const selectedDateRevenueData = await Booking.aggregate([
      { $match: { status: 'Completed', bookingDate: { $gte: startOfRange, $lte: endOfRange } } },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);
    const selectedDateRevenue = selectedDateRevenueData[0]?.total || 0;
    const selectedDateOccupancy = Math.round((selectedDateCount / (14 * diffDays)) * 100);

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);

    const startOfToday = new Date(today.setUTCHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setUTCHours(23, 59, 59, 999));

    const tomorrow = new Date(todayStr);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const startOfTomorrow = new Date(tomorrow.setUTCHours(0, 0, 0, 0));
    const endOfTomorrow = new Date(tomorrow.setUTCHours(23, 59, 59, 999));

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    const todayCount = await Booking.countDocuments({ bookingDate: { $gte: startOfToday, $lte: endOfToday } });
    const tomorrowCount = await Booking.countDocuments({ bookingDate: { $gte: startOfTomorrow, $lte: endOfTomorrow } });
    const upcomingCount = await Booking.countDocuments({ bookingDate: { $gte: startOfToday }, status: { $in: ['Pending', 'Confirmed'] } });
    const monthlyCount = await Booking.countDocuments({ bookingDate: { $gte: startOfMonth, $lte: endOfMonth } });
    const completedCount = await Booking.countDocuments({ status: 'Completed' });
    const cancelledCount = await Booking.countDocuments({ status: 'Cancelled' });

    // Recent bookings specifically for the filtered range
    let recentBookings = [];
    if (startDate || endDate || date) {
      recentBookings = await Booking.find({ bookingDate: { $gte: startOfRange, $lte: endOfRange } }).sort({ createdAt: -1 });
    } else {
      recentBookings = await Booking.find().sort({ createdAt: -1 }).limit(5);
    }

    // Revenue calculations
    const monthlyRevenueData = await Booking.aggregate([
      { $match: { status: 'Completed', bookingDate: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);
    const monthlyRevenue = monthlyRevenueData[0]?.total || 0;

    // Weekly booking counts
    const startOfSevenDaysAgo = new Date();
    startOfSevenDaysAgo.setDate(startOfSevenDaysAgo.getDate() - 7);
    const weeklyStats = await Booking.aggregate([
      { $match: { bookingDate: { $gte: startOfSevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } },
          count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, '$price', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Peak booking hours
    const peakHours = await Booking.aggregate([
      { $group: { _id: '$startTime', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Status breakdown
    const statusStats = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Occupancy estimation (assuming standard 14 slots/day capacity)
    const bookingsThisMonth = await Booking.countDocuments({
      bookingDate: { $gte: startOfMonth, $lte: endOfMonth },
      status: { $in: ['Confirmed', 'Completed'] },
    });
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
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
      recentBookings,
      weeklyStats,
      peakHours,
      statusStats,
    });
  } catch (error) {
    next(error);
  }
};
