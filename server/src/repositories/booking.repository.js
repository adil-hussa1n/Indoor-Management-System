import Booking from '../models/Booking.js';
import BookingStatusHistory from '../models/BookingStatusHistory.js';
import { Op } from 'sequelize';

class BookingRepository {
  async create(data, options = {}) {
    return await Booking.create(data, options);
  }

  async findById(id, options = {}) {
    return await Booking.findByPk(id, options);
  }

  async findByUuid(uuid) {
    return await Booking.findOne({ where: { uuid } });
  }

  async findAll(where = {}, options = {}) {
    return await Booking.findAll({ where, ...options });
  }

  async findAndCountAll(where = {}, options = {}) {
    return await Booking.findAndCountAll({ where, ...options });
  }

  async countAll(where = {}) {
    return await Booking.count({ where });
  }

  async sumPrice(where = {}) {
    return await Booking.sum('price', { where }) || 0;
  }

  async update(id, data, options = {}) {
    const booking = await Booking.findByPk(id, options);
    if (!booking) return null;
    await booking.update(data, options);
    return booking;
  }

  async delete(id) {
    const booking = await Booking.findByPk(id);
    if (!booking) return null;
    await booking.destroy(); // Soft delete (paranoid)
    return booking;
  }

  async findOverlapping(dateStr, startTime, endTime, options = {}) {
    return await Booking.findAll({
      where: {
        bookingDate: dateStr,
        status: { [Op.in]: ['Pending', 'Confirmed', 'Completed'] },
        [Op.or]: [
          { startTime: { [Op.gte]: startTime, [Op.lt]: endTime } },
          { endTime: { [Op.gt]: startTime, [Op.lte]: endTime } },
          {
            startTime: { [Op.lte]: startTime },
            endTime: { [Op.gte]: endTime },
          },
        ],
      },
      lock: options.transaction ? options.transaction.LOCK.UPDATE : undefined,
      ...options,
    });
  }

  async countWithPrefix(prefix) {
    return await Booking.count({
      where: {
        bookingId: { [Op.like]: `${prefix}%` },
      },
      paranoid: false,
    });
  }

  async createStatusHistory(data, options = {}) {
    return await BookingStatusHistory.create(data, options);
  }

  async getGroupedByDate(startDate, endDate) {
    return await Booking.findAll({
      attributes: [
        'bookingDate',
        [Booking.sequelize.fn('COUNT', Booking.sequelize.col('id')), 'count'],
        [Booking.sequelize.fn('SUM',
          Booking.sequelize.literal("CASE WHEN status = 'Completed' THEN price ELSE 0 END")
        ), 'revenue'],
      ],
      where: {
        bookingDate: { [Op.gte]: startDate, [Op.lte]: endDate },
      },
      group: ['bookingDate'],
      order: [['bookingDate', 'ASC']],
      raw: true,
    });
  }

  async getGroupedByStartTime() {
    return await Booking.findAll({
      attributes: [
        'startTime',
        [Booking.sequelize.fn('COUNT', Booking.sequelize.col('id')), 'count'],
      ],
      group: ['startTime'],
      order: [[Booking.sequelize.fn('COUNT', Booking.sequelize.col('id')), 'DESC']],
      raw: true,
    });
  }

  async getGroupedByStatus() {
    return await Booking.findAll({
      attributes: [
        'status',
        [Booking.sequelize.fn('COUNT', Booking.sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });
  }
}

export default new BookingRepository();
