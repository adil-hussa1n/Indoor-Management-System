import slotRepository from '../repositories/slot.repository.js';
import bookingRepository from '../repositories/booking.repository.js';
import settingsRepository from '../repositories/settings.repository.js';
import { Op } from 'sequelize';

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

    const dateString = date.split('T')[0];
    const settings = await settingsRepository.getOrCreate();
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

    // Hierarchical slot lookup
    let allSlots = await slotRepository.findAll(
      { isActive: true, specificDate: dateString },
      { order: [['startTime', 'ASC']] }
    );

    if (allSlots.length === 0) {
      const dayOfWeek = queryDate.getUTCDay();
      allSlots = await slotRepository.findAll(
        { isActive: true, dayOfWeek, specificDate: null },
        { order: [['startTime', 'ASC']] }
      );
    }

    if (allSlots.length === 0) {
      allSlots = await slotRepository.findAll(
        { isActive: true, dayOfWeek: -1, specificDate: null },
        { order: [['startTime', 'ASC']] }
      );
    }

    // Fetch bookings for this date that are not Cancelled
    const bookings = await bookingRepository.findAll({
      bookingDate: dateString,
      status: { [Op.ne]: 'Cancelled' },
    });

    const mappedSlots = allSlots.map((slot) => {
      const isBooked = bookings.some((booking) => {
        return (
          (slot.startTime >= booking.startTime && slot.startTime < booking.endTime) ||
          (slot.endTime > booking.startTime && slot.endTime <= booking.endTime) ||
          (booking.startTime >= slot.startTime && booking.endTime <= slot.endTime)
        );
      });

      return {
        id: slot.id,
        _id: slot.id,
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
    const slots = await slotRepository.findAll({}, { order: [['startTime', 'ASC']] });
    const mapped = slots.map(s => {
      const plain = s.toJSON();
      plain._id = plain.id;
      return plain;
    });
    res.status(200).json({ success: true, slots: mapped });
  } catch (error) {
    next(error);
  }
};

export const createSlot = async (req, res, next) => {
  try {
    const { startTime, endTime, dayOfWeek, specificDate, rateType } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Start time and End time are required' });
    }

    const slot = await slotRepository.create({
      startTime,
      endTime,
      dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : -1,
      specificDate: specificDate || null,
      rateType: rateType || 'day',
    });

    const plain = slot.toJSON();
    plain._id = plain.id;
    res.status(201).json({ success: true, slot: plain });
  } catch (error) {
    next(error);
  }
};

export const updateSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, isActive, dayOfWeek, specificDate, rateType } = req.body;

    const slot = await slotRepository.findById(id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    const updateData = {};
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = Number(dayOfWeek);
    if (specificDate !== undefined) updateData.specificDate = specificDate;
    if (rateType !== undefined) updateData.rateType = rateType;

    await slotRepository.update(slot, updateData);

    const plain = slot.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, slot: plain });
  } catch (error) {
    next(error);
  }
};

export const deleteSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await slotRepository.delete(id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    res.status(200).json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    next(error);
  }
};
