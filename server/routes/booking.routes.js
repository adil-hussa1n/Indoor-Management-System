import express from 'express';
import {
  createBooking,
  getBookings,
  getBookingById,
  createManualBooking,
  updateBooking,
  updateBookingStatus,
  deleteBooking,
  getDashboardData,
} from '../controllers/booking.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public route
router.post('/booking', createBooking);

// Admin protected routes
router.get('/dashboard', protect, getDashboardData);
router.get('/bookings', protect, getBookings);
router.post('/bookings', protect, createManualBooking);
router.get('/bookings/:id', protect, getBookingById);
router.patch('/bookings/:id', protect, updateBooking);
router.delete('/bookings/:id', protect, deleteBooking);
router.patch('/booking-status/:id', protect, updateBookingStatus);

export default router;
