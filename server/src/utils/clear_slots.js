import 'dotenv/config';
import { sequelize, Slot, Booking, BookingStatusHistory } from '../models/index.js';

async function clear() {
  try {
    await sequelize.authenticate();
    console.log('DB Connected.');
    
    await BookingStatusHistory.destroy({ where: {}, force: true });
    await Booking.destroy({ where: {}, force: true });
    await Slot.destroy({ where: {}, force: true });

    console.log('Slots, bookings and histories cleared successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clear();
