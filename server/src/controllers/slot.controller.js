import { Op } from 'sequelize';

// Get available slots for a given date
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { slotRepo, bookingRepo, settingsRepo } = req.repos;
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const dateString = date.split('T')[0];
    
    // Parse the date components locally to get the correct day of week (0-6)
    // This avoids timezone shifts shifting the weekday to the previous/next day.
    const parts = dateString.split('-');
    if (parts.length !== 3) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    const localDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(localDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date values' });
    }
    const dayOfWeek = localDate.getDay();

    const settings = await settingsRepo.getOrCreate();
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

    // Hierarchical slot lookup based on count existence:
    // 1. Check if specific override slots are defined at all for this date (active or inactive)
    const specificCount = await slotRepo.count({ specificDate: dateString });
    let allSlots = [];

    if (specificCount > 0) {
      // Custom schedule defined for this date -> load active ones, do not fall back
      allSlots = await slotRepo.findAll(
        { isActive: true, specificDate: dateString },
        { order: [['startTime', 'ASC']] }
      );
    } else {
      // 2. Check if weekly day slots are defined at all for this weekday (active or inactive)
      const weeklyCount = await slotRepo.count({ dayOfWeek, specificDate: null });
      if (weeklyCount > 0) {
        // Custom weekly day schedule defined -> load active ones, do not fall back
        allSlots = await slotRepo.findAll(
          { isActive: true, dayOfWeek, specificDate: null },
          { order: [['startTime', 'ASC']] }
        );
      } else {
        // 3. Fall back to general daily slots
        allSlots = await slotRepo.findAll(
          { isActive: true, dayOfWeek: -1, specificDate: null },
          { order: [['startTime', 'ASC']] }
        );
      }
    }

    // Fetch bookings for this date that are not Cancelled
    const bookings = await bookingRepo.findAll({
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
        rateType: slot.rateType,
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
    const { slotRepo } = req.repos;
    const slots = await slotRepo.findAll({}, { order: [['startTime', 'ASC']] });
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
    const { slotRepo } = req.repos;
    const { startTime, endTime, dayOfWeek, specificDate, rateType } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Start time and End time are required' });
    }

    // 1. Time range validation (startTime must be before endTime)
    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'Start time must be strictly before End time.' });
    }

    const targetDayOfWeek = dayOfWeek !== undefined ? Number(dayOfWeek) : -1;
    const targetSpecificDate = specificDate || null;

    // 2. Overlap/Collision validation in the same category
    const existingSlots = await slotRepo.findAll({
      dayOfWeek: targetDayOfWeek,
      specificDate: targetSpecificDate,
      isActive: true
    });

    for (const existing of existingSlots) {
      const isOverlapping = !(endTime <= existing.startTime || startTime >= existing.endTime);
      if (isOverlapping) {
        return res.status(400).json({
          success: false,
          message: `This slot overlaps with an existing time slot (${existing.startTime} - ${existing.endTime}) in this category.`,
        });
      }
    }

    const slot = await slotRepo.create({
      startTime,
      endTime,
      dayOfWeek: targetDayOfWeek,
      specificDate: targetSpecificDate,
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
    const { slotRepo } = req.repos;
    const { id } = req.params;
    const { startTime, endTime, isActive, dayOfWeek, specificDate, rateType } = req.body;

    const slot = await slotRepo.findById(id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    const newStartTime = startTime !== undefined ? startTime : slot.startTime;
    const newEndTime = endTime !== undefined ? endTime : slot.endTime;
    const newDayOfWeek = dayOfWeek !== undefined ? Number(dayOfWeek) : slot.dayOfWeek;
    const newSpecificDate = specificDate !== undefined ? (specificDate || null) : slot.specificDate;
    const newIsActive = isActive !== undefined ? isActive : slot.isActive;

    // 1. Time range validation
    if (newStartTime >= newEndTime) {
      return res.status(400).json({ success: false, message: 'Start time must be strictly before End time.' });
    }

    // 2. Overlap/Collision validation (only if slot is active or being activated)
    if (newIsActive) {
      const existingSlots = await slotRepo.findAll({
        dayOfWeek: newDayOfWeek,
        specificDate: newSpecificDate,
        isActive: true
      });

      for (const existing of existingSlots) {
        // Skip current slot itself
        if (existing.id === slot.id) continue;

        const isOverlapping = !(newEndTime <= existing.startTime || newStartTime >= existing.endTime);
        if (isOverlapping) {
          return res.status(400).json({
            success: false,
            message: `This slot overlaps with an existing time slot (${existing.startTime} - ${existing.endTime}) in this category.`,
          });
        }
      }
    }

    const updateData = {};
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = Number(dayOfWeek);
    if (specificDate !== undefined) updateData.specificDate = specificDate;
    if (rateType !== undefined) updateData.rateType = rateType;

    await slotRepo.update(id, updateData);
    const updated = await slotRepo.findById(id);

    const plain = updated.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, slot: plain });
  } catch (error) {
    next(error);
  }
};

export const deleteSlot = async (req, res, next) => {
  try {
    const { slotRepo } = req.repos;
    const { id } = req.params;
    const slot = await slotRepo.delete(id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    res.status(200).json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    next(error);
  }
};
