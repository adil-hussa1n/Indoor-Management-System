import Booking from '../models/Booking.js';
import Settings from '../models/Settings.js';
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

// Helper to calculate price based on day type (Weekend, Holiday, Regular)
const calculatePrice = async (dateStr, duration) => {
  const settings = await Settings.findOne() || {
    pricing: { hourlyRate: 40, weekendRate: 55, holidayRate: 65 },
  };

  const bookingDate = new Date(dateStr);
  const dateString = dateStr.split('T')[0];

  // 1. Check Holiday
  if (settings.holidays && settings.holidays.includes(dateString)) {
    return duration * settings.pricing.holidayRate;
  }

  // 2. Check Weekend (Saturday=6, Sunday=0)
  const day = bookingDate.getUTCDay();
  if (day === 0 || day === 6) {
    return duration * settings.pricing.weekendRate;
  }

  // 3. Regular Rate
  return duration * settings.pricing.hourlyRate;
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

    const calculatedPrice = await calculatePrice(data.bookingDate, data.duration);
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

    const calculatedPrice = await calculatePrice(data.bookingDate, data.duration);
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
    
    // Re-calculate price if date/duration changed
    if (req.body.bookingDate || req.body.duration) {
      booking.price = await calculatePrice(booking.bookingDate.toISOString(), booking.duration);
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
    const { date } = req.query;
    let selectedDate = new Date();
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        selectedDate = parsed;
      }
    }

    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const startOfSelected = new Date(new Date(selectedDateStr).setUTCHours(0, 0, 0, 0));
    const endOfSelected = new Date(new Date(selectedDateStr).setUTCHours(23, 59, 59, 999));

    // Calculate metrics for selected date
    const selectedDateCount = await Booking.countDocuments({ bookingDate: { $gte: startOfSelected, $lte: endOfSelected } });
    const selectedDateRevenueData = await Booking.aggregate([
      { $match: { status: 'Completed', bookingDate: { $gte: startOfSelected, $lte: endOfSelected } } },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);
    const selectedDateRevenue = selectedDateRevenueData[0]?.total || 0;
    const selectedDateOccupancy = Math.round((selectedDateCount / 14) * 100);

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

    // Recent bookings specifically for the filtered date, or fallback to all recent
    let recentBookings = [];
    if (date) {
      recentBookings = await Booking.find({ bookingDate: { $gte: startOfSelected, $lte: endOfSelected } }).sort({ createdAt: -1 });
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
