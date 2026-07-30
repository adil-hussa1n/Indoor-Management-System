import express from 'express';
import { protect, protectUser } from '../middlewares/auth.js';

const router = express.Router();

// ── User-side Routes ──

// POST /api/v1/booking-requests/:bookingId/change
router.post('/booking-requests/:bookingId/change', protectUser, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { newDate, newStartTime, newEndTime, reason } = req.body;

    const booking = await req.repos.bookingRepo.findById(parseInt(bookingId));
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your booking' });
    }
    if (['Cancelled', 'Completed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot modify a cancelled or completed booking' });
    }

    const request = await req.repos.bookingRequestRepo.create({
      bookingId: booking.id,
      userId: req.user.id,
      type: 'change',
      requestData: { newDate, newStartTime, newEndTime, reason },
    });

    // Emit socket event for admin notification
    const io = req.app.get('io');
    if (io) io.emit('new-booking-request', { type: 'change', bookingId: booking.bookingId });

    res.status(201).json({ success: true, message: 'Change request submitted', request });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/booking-requests/:bookingId/cancel
router.post('/booking-requests/:bookingId/cancel', protectUser, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await req.repos.bookingRepo.findById(parseInt(bookingId));
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your booking' });
    }
    if (['Cancelled', 'Completed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed or already cancelled booking' });
    }

    const request = await req.repos.bookingRequestRepo.create({
      bookingId: booking.id,
      userId: req.user.id,
      type: 'cancel',
      requestData: { reason },
    });

    const io = req.app.get('io');
    if (io) io.emit('new-booking-request', { type: 'cancel', bookingId: booking.bookingId });

    res.status(201).json({ success: true, message: 'Cancel request submitted', request });
  } catch (error) {
    next(error);
  }
});

// ── Admin-side Routes ──

// GET /api/v1/booking-requests
router.get('/booking-requests', protect, async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const requests = await req.repos.bookingRequestRepo.findAll(where, {
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({ success: true, requests });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/booking-requests/:id
router.patch('/booking-requests/:id', protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    const request = await req.repos.bookingRequestRepo.findById(parseInt(id));
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }

    // Update request status
    await req.repos.bookingRequestRepo.update(request.id, { status, adminNote });

    // If approved, apply the change
    if (status === 'approved') {
      if (request.type === 'cancel') {
        await req.repos.bookingRepo.update(request.bookingId, { status: 'Cancelled' });
        await req.repos.statusHistoryRepo.create({
          bookingId: request.bookingId,
          previousStatus: request.booking?.status,
          newStatus: 'Cancelled',
          changedBy: `admin:${req.admin.username}`,
          reason: 'User cancellation request approved',
        });
      } else if (request.type === 'change') {
        const { newDate, newStartTime, newEndTime } = request.requestData || {};
        const updateData = {};
        if (newDate) updateData.bookingDate = newDate;
        if (newStartTime) updateData.startTime = newStartTime;
        if (newEndTime) updateData.endTime = newEndTime;
        if (Object.keys(updateData).length > 0) {
          await req.repos.bookingRepo.update(request.bookingId, updateData);
        }
      }
    }

    const io = req.app.get('io');
    if (io) io.emit('booking-request-updated', { id: request.id, status });

    const updated = await req.repos.bookingRequestRepo.findById(parseInt(id));
    res.status(200).json({ success: true, request: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
