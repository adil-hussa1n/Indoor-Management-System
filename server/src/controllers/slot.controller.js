import { Op } from 'sequelize';
import { createAuditLog } from '../utils/auditLogger.js';

// Helper to get local date and time in Bangladesh timezone (UTC+6)
const getBangladeshDateTime = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  let hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  
  if (hour === '24') {
    hour = '00';
  }
  
  return {
    dateString: `${year}-${month}-${day}`,
    timeString: `${hour}:${minute}`
  };
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

// Get available slots for a given date
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { slotRepo, bookingRepo, settingsRepo, groundRepo } = req.repos;
    const { date, groundId } = req.query;
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

    let targetGroundId = groundId ? Number(groundId) : null;
    if (!targetGroundId) {
      const firstGround = await groundRepo.findAll({}, { limit: 1 });
      if (firstGround && firstGround.length > 0) {
        targetGroundId = firstGround[0].id;
      } else {
        targetGroundId = 1;
      }
    }

    // Hierarchical slot lookup based on count existence:
    // 1. Check if specific override slots are defined at all for this date (active or inactive)
    const specificCount = await slotRepo.count({ specificDate: dateString, groundId: targetGroundId });
    let allSlots = [];

    if (specificCount > 0) {
      // Custom schedule defined for this date -> load active ones, do not fall back
      allSlots = await slotRepo.findAll(
        { isActive: true, specificDate: dateString, groundId: targetGroundId },
        { order: [['startTime', 'ASC']] }
      );
    } else {
      // 2. Check if weekly day slots are defined at all for this weekday (active or inactive)
      const weeklyCount = await slotRepo.count({ dayOfWeek, specificDate: null, groundId: targetGroundId });
      if (weeklyCount > 0) {
        // Custom weekly day schedule defined -> load active ones, do not fall back
        allSlots = await slotRepo.findAll(
          { isActive: true, dayOfWeek, specificDate: null, groundId: targetGroundId },
          { order: [['startTime', 'ASC']] }
        );
      } else {
        // 3. Fall back to general daily slots
        allSlots = await slotRepo.findAll(
          { isActive: true, dayOfWeek: -1, specificDate: null, groundId: targetGroundId },
          { order: [['startTime', 'ASC']] }
        );
      }
    }

    // Fetch bookings for this date that are Confirmed or Pending (paid/accepted)
    const bookings = await bookingRepo.findAll({
      bookingDate: dateString,
      groundId: targetGroundId,
      status: { [Op.in]: ['Confirmed', 'Pending'] },
    });

    const { dateString: todayString, timeString: currentTime } = getBangladeshDateTime();

    const mappedSlots = allSlots.map((slot) => {
      const isBooked = bookings.some((booking) => {
        return (
          (slot.startTime >= booking.startTime && slot.startTime < booking.endTime) ||
          (slot.endTime > booking.startTime && slot.endTime <= booking.endTime) ||
          (booking.startTime >= slot.startTime && booking.endTime <= slot.endTime)
        );
      });

      // A slot is available if it is not booked AND (if the booking is for today) it has not already passed/started
      let isAvailable = !isBooked;
      if (isAvailable && dateString === todayString) {
        isAvailable = slot.startTime >= currentTime;
      }

      let effectivePrice = Number(slot.price);
      if (!effectivePrice || effectivePrice <= 0) {
        effectivePrice = getSlotPriceForDate(settings, dateString, slot.startTime, slot.rateType);
      }

      return {
        id: slot.id,
        _id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable,
        rateType: slot.rateType,
        price: effectivePrice,
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
    const { groundId } = req.query;
    
    const where = groundId ? { groundId: Number(groundId) } : {};
    const slots = await slotRepo.findAll(where, { 
      order: [['startTime', 'ASC']],
      include: [{ model: req.models.Ground, as: 'ground' }]
    });

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
    const { slotRepo, groundRepo } = req.repos;
    const { startTime, endTime, dayOfWeek, specificDate, rateType, groundId } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Start time and End time are required' });
    }

    // 1. Time range validation (startTime must be before endTime)
    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'Start time must be strictly before End time.' });
    }

    let targetGroundId = groundId ? Number(groundId) : null;
    if (!targetGroundId) {
      const firstGround = await groundRepo.findAll({}, { limit: 1 });
      if (firstGround && firstGround.length > 0) {
        targetGroundId = firstGround[0].id;
      } else {
        targetGroundId = 1;
      }
    }

    const targetDayOfWeek = dayOfWeek !== undefined ? Number(dayOfWeek) : -1;
    const targetSpecificDate = specificDate || null;

    // 2. Overlap/Collision validation in the same category & ground
    const existingSlots = await slotRepo.findAll({
      groundId: targetGroundId,
      dayOfWeek: targetDayOfWeek,
      specificDate: targetSpecificDate,
      isActive: true
    });

    for (const existing of existingSlots) {
      const isOverlapping = !(endTime <= existing.startTime || startTime >= existing.endTime);
      if (isOverlapping) {
        return res.status(400).json({
          success: false,
          message: `This slot overlaps with an existing time slot (${existing.startTime} - ${existing.endTime}) in this arena.`,
        });
      }
    }

    const slot = await slotRepo.create({
      startTime,
      endTime,
      dayOfWeek: targetDayOfWeek,
      specificDate: targetSpecificDate,
      rateType: rateType || 'day',
      groundId: targetGroundId,
    });

    createAuditLog(req, {
      action: 'CREATE_SLOT',
      category: 'slots',
      entity: 'Slot',
      entityId: slot.id,
      description: `Created time slot (${slot.startTime} - ${slot.endTime})`,
      newValue: slot.toJSON ? slot.toJSON() : slot,
    }).catch(err => console.error(err));

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
    const { startTime, endTime, isActive, dayOfWeek, specificDate, rateType, groundId } = req.body;

    const slot = await slotRepo.findById(id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    const oldValues = slot.toJSON ? slot.toJSON() : slot;

    const newStartTime = startTime !== undefined ? startTime : slot.startTime;
    const newEndTime = endTime !== undefined ? endTime : slot.endTime;
    const newDayOfWeek = dayOfWeek !== undefined ? Number(dayOfWeek) : slot.dayOfWeek;
    const newSpecificDate = specificDate !== undefined ? (specificDate || null) : slot.specificDate;
    const newIsActive = isActive !== undefined ? isActive : slot.isActive;
    const newGroundId = groundId !== undefined ? Number(groundId) : slot.groundId;

    // 1. Time range validation
    if (newStartTime >= newEndTime) {
      return res.status(400).json({ success: false, message: 'Start time must be strictly before End time.' });
    }

    // 2. Overlap/Collision validation (only if slot is active or being activated)
    if (newIsActive) {
      const existingSlots = await slotRepo.findAll({
        groundId: newGroundId,
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
            message: `This slot overlaps with an existing time slot (${existing.startTime} - ${existing.endTime}) in this arena.`,
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
    if (groundId !== undefined) updateData.groundId = Number(groundId);

    await slotRepo.update(id, updateData);
    const updated = await slotRepo.findById(id);

    createAuditLog(req, {
      action: 'UPDATE_SLOT',
      category: 'slots',
      entity: 'Slot',
      entityId: updated.id,
      description: `Updated time slot (${updated.startTime} - ${updated.endTime})`,
      oldValue: oldValues,
      newValue: updated.toJSON ? updated.toJSON() : updated,
    }).catch(err => console.error(err));

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
    const existingSlot = await slotRepo.findById ? await slotRepo.findById(id) : null;
    const oldValues = existingSlot ? (existingSlot.toJSON ? existingSlot.toJSON() : existingSlot) : null;

    const slot = await slotRepo.delete(id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    createAuditLog(req, {
      action: 'DELETE_SLOT',
      category: 'slots',
      entity: 'Slot',
      entityId: Number(id),
      description: `Deleted time slot #${id}`,
      oldValue: oldValues,
    }).catch(err => console.error(err));

    res.status(200).json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getCalendarAvailability = async (req, res, next) => {
  try {
    const { slotRepo, bookingRepo, settingsRepo, groundRepo } = req.repos;
    const { year, month, groundId } = req.query;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'Year and Month are required' });
    }

    const y = Number(year);
    const m = Number(month);

    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ success: false, message: 'Invalid Year or Month' });
    }

    let targetGroundId = groundId ? Number(groundId) : null;
    if (!targetGroundId) {
      const firstGround = await groundRepo.findAll({}, { limit: 1 });
      if (firstGround && firstGround.length > 0) {
        targetGroundId = firstGround[0].id;
      } else {
        targetGroundId = 1;
      }
    }

    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const settings = await settingsRepo.getOrCreate();
    const holidays = settings.holidays || [];
    const maintenanceDays = settings.maintenanceDays || [];

    const activeSlots = await slotRepo.findAll({ isActive: true, groundId: targetGroundId });

    const bookings = await bookingRepo.findAll({
      bookingDate: {
        [Op.between]: [startDate, endDate],
      },
      groundId: targetGroundId,
      status: { [Op.in]: ['Confirmed', 'Pending'] },
    });

    const { dateString: todayString, timeString: currentTime } = getBangladeshDateTime();

    const availability = {};

    for (let day = 1; day <= lastDay; day++) {
      const dateString = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const localDate = new Date(y, m - 1, day);
      const dayOfWeek = localDate.getDay();

      if (holidays.includes(dateString) || maintenanceDays.includes(dateString) || dateString < todayString) {
        availability[dateString] = 'gray';
        continue;
      }

      let dateSlots = activeSlots.filter(s => s.specificDate === dateString);
      if (dateSlots.length === 0) {
        const specificExists = activeSlots.some(s => s.specificDate === dateString);
        if (!specificExists) {
          dateSlots = activeSlots.filter(s => s.dayOfWeek === dayOfWeek && s.specificDate === null);
          const weeklyExists = activeSlots.some(s => s.dayOfWeek === dayOfWeek && s.specificDate === null);
          if (dateSlots.length === 0 && !weeklyExists) {
            dateSlots = activeSlots.filter(s => s.dayOfWeek === -1 && s.specificDate === null);
          }
        }
      }

      if (dateSlots.length === 0) {
        availability[dateString] = 'gray';
        continue;
      }

      const dayBookings = bookings.filter(b => b.bookingDate === dateString);

      let availableCount = 0;
      let bookedCount = 0;

      for (const slot of dateSlots) {
        const isBooked = dayBookings.some((booking) => {
          return (
            (slot.startTime >= booking.startTime && slot.startTime < booking.endTime) ||
            (slot.endTime > booking.startTime && slot.endTime <= booking.endTime) ||
            (booking.startTime >= slot.startTime && booking.endTime <= slot.endTime)
          );
        });

        if (isBooked) {
          bookedCount++;
        } else {
          if (dateString === todayString) {
            if (slot.startTime >= currentTime) {
              availableCount++;
            } else {
              bookedCount++;
            }
          } else {
            availableCount++;
          }
        }
      }

      if (availableCount === 0) {
        availability[dateString] = 'red';
      } else if (bookedCount === 0) {
        availability[dateString] = 'green';
      } else {
        availability[dateString] = 'yellow';
      }
    }

    res.status(200).json({
      success: true,
      availability,
    });
  } catch (error) {
    next(error);
  }
};
