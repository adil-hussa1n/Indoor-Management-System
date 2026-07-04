import { sequelize } from '../config/sequelize.js';
import Admin from './Admin.js';
import Booking from './Booking.js';
import BookingStatusHistory from './BookingStatusHistory.js';
import Slot from './Slot.js';
import SlotLock from './SlotLock.js';
import Review from './Review.js';
import Gallery from './Gallery.js';
import Contact from './Contact.js';
import Settings from './Settings.js';
import AuditLog from './AuditLog.js';

// ── Associations ──

// Booking <-> BookingStatusHistory
Booking.hasMany(BookingStatusHistory, { foreignKey: 'bookingId', as: 'statusHistory' });
BookingStatusHistory.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

// Sync all models (creates tables if they don't exist)
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('All MySQL tables synced successfully');
  } catch (error) {
    console.error('Error syncing database tables:', error.message);
    throw error;
  }
};

export {
  sequelize,
  Admin,
  Booking,
  BookingStatusHistory,
  Slot,
  SlotLock,
  Review,
  Gallery,
  Contact,
  Settings,
  AuditLog,
  syncDatabase,
};
