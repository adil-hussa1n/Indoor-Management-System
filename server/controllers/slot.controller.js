import Slot from '../models/Slot.js';
import Booking from '../models/Booking.js';
import Settings from '../models/Settings.js';

// Get available slots for a given date
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const queryDate = new Date(date);
    if (isNaN(queryDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    // Format query date as YYYY-MM-DD
    const dateString = date.split('T')[0];

    // Fetch settings to check holiday or maintenance days
    const settings = await Settings.findOne() || {};
    const holidays = settings.holidays || [];
    const maintenanceDays = settings.maintenanceDays || [];

    if (holidays.includes(dateString) || maintenanceDays.includes(dateString)) {
      return res.status(200).json({
        success: true,
        isBlocked: true,
        reason: holidays.includes(dateString) ? 'Holiday' : 'Maintenance Mode',
        slots: [],
      });
    }

    // Fetch active slots hierarchically:
    // 1. Check if there are slots specifically for this date
    let allSlots = await Slot.find({ isActive: true, specificDate: dateString }).sort({ startTime: 1 });

    // 2. If none, check if there are slots specifically for this day of the week
    if (allSlots.length === 0) {
      const dayOfWeek = queryDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      allSlots = await Slot.find({ isActive: true, dayOfWeek, specificDate: null }).sort({ startTime: 1 });
    }

    // 3. If still none, fallback to general slots
    if (allSlots.length === 0) {
      allSlots = await Slot.find({ isActive: true, dayOfWeek: -1, specificDate: null }).sort({ startTime: 1 });
    }

    // Fetch bookings for this date that are not Cancelled
    const startOfDay = new Date(queryDate.setUTCHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setUTCHours(23, 59, 59, 999));

    const bookings = await Booking.find({
      bookingDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'Cancelled' },
    });

    const mappedSlots = allSlots.map((slot) => {
      const isBooked = bookings.some((booking) => {
        // Simple string comparison for times "HH:MM"
        // Handles overlap logic
        return (
          (slot.startTime >= booking.startTime && slot.startTime < booking.endTime) ||
          (slot.endTime > booking.startTime && slot.endTime <= booking.endTime) ||
          (booking.startTime >= slot.startTime && booking.endTime <= slot.endTime)
        );
      });

      return {
        id: slot._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable: !isBooked,
      };
    });

    res.status(200).json({
      success: true,
      isBlocked: false,
      slots: mappedSlots,
    });
  } catch (error) {
    next(error);
  }
};

// Admin slot CRUD
export const getSlots = async (req, res, next) => {
  try {
    const slots = await Slot.find().sort({ startTime: 1 });
    res.status(200).json({ success: true, slots });
  } catch (error) {
    next(error);
  }
};

export const createSlot = async (req, res, next) => {
  try {
    const { startTime, endTime, dayOfWeek, specificDate } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Start time and End time are required' });
    }

    const slot = await Slot.create({
      startTime,
      endTime,
      dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : -1,
      specificDate: specificDate || null,
    });
    res.status(201).json({ success: true, slot });
  } catch (error) {
    next(error);
  }
};

export const updateSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, isActive, dayOfWeek, specificDate } = req.body;

    const slot = await Slot.findById(id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    if (startTime !== undefined) slot.startTime = startTime;
    if (endTime !== undefined) slot.endTime = endTime;
    if (isActive !== undefined) slot.isActive = isActive;
    if (dayOfWeek !== undefined) slot.dayOfWeek = Number(dayOfWeek);
    if (specificDate !== undefined) slot.specificDate = specificDate;

    await slot.save();
    res.status(200).json({ success: true, slot });
  } catch (error) {
    next(error);
  }
};

export const deleteSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await Slot.findByIdAndDelete(id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    res.status(200).json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    next(error);
  }
};
