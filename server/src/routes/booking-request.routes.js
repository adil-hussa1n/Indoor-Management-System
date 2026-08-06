import express from 'express';
import { protect, protectUser } from '../middlewares/auth.js';
import sendSMS from '../utils/sms.js';
import { Op } from 'sequelize';

const router = express.Router();

// Helper: format 24h time to 12h
const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${m} ${ampm}`;
};

// Check for suspicious rescheduling/cancellations
const checkSuspiciousActivity = async (req, userId) => {
  const { bookingRequestRepo, bookingRepo } = req.repos;
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // 1. Check for change/cancel requests in the last 24 hours
  const recentRequestsCount = await req.tenantDb.models.BookingRequest.count({
    where: {
      userId,
      createdAt: { [Op.gt]: dayAgo }
    }
  });

  // 2. Check for cancelled bookings in the last 24 hours
  const recentCancellationsCount = await req.tenantDb.models.Booking.count({
    where: {
      userId,
      status: 'Cancelled',
      updatedAt: { [Op.gt]: dayAgo }
    }
  });

  // 3. Check for high frequency (spamming) in the last 5 minutes
  const rapidRequestsCount = await req.tenantDb.models.BookingRequest.count({
    where: {
      userId,
      createdAt: { [Op.gt]: fiveMinsAgo }
    }
  });

  let isSuspicious = false;
  let reasons = [];

  if (recentRequestsCount >= 3) {
    isSuspicious = true;
    reasons.push(`${recentRequestsCount} change/cancel requests submitted in the last 24 hours`);
  }
  if (recentCancellationsCount >= 2) {
    isSuspicious = true;
    reasons.push(`${recentCancellationsCount} bookings cancelled in the last 24 hours`);
  }
  if (rapidRequestsCount >= 2) {
    isSuspicious = true;
    reasons.push(`High frequency: ${rapidRequestsCount} requests submitted in the last 5 minutes`);
  }

  return {
    isSuspicious,
    suspiciousReason: isSuspicious ? reasons.join('; ') : null
  };
};

// ── User-side Routes ──

// POST /api/v1/booking-requests/:bookingId/change
router.post('/booking-requests/:bookingId/change', protectUser, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { newDate, newStartTime, newEndTime, newGroundId, reason } = req.body;

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

    const { isSuspicious, suspiciousReason } = await checkSuspiciousActivity(req, req.user.id);

    const request = await req.repos.bookingRequestRepo.create({
      bookingId: booking.id,
      userId: req.user.id,
      type: 'change',
      requestData: { newDate, newStartTime, newEndTime, newGroundId, reason },
      isSuspicious,
      suspiciousReason,
    });

    // Emit socket event for admin notification
    const io = req.app.get('io');
    if (io) {
      io.emit('new-booking-request', { 
        type: 'change', 
        bookingId: booking.bookingId,
        isSuspicious,
        suspiciousReason
      });
      if (isSuspicious) {
        io.emit('suspicious-user-activity', {
          userId: req.user.id,
          userName: req.user.name || 'Customer',
          phone: req.user.phone,
          reason: suspiciousReason,
          bookingId: booking.bookingId,
          requestId: request.id,
        });
      }
    }

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

    const { isSuspicious, suspiciousReason } = await checkSuspiciousActivity(req, req.user.id);

    const request = await req.repos.bookingRequestRepo.create({
      bookingId: booking.id,
      userId: req.user.id,
      type: 'cancel',
      requestData: { reason },
      isSuspicious,
      suspiciousReason,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('new-booking-request', { 
        type: 'cancel', 
        bookingId: booking.bookingId,
        isSuspicious,
        suspiciousReason
      });
      if (isSuspicious) {
        io.emit('suspicious-user-activity', {
          userId: req.user.id,
          userName: req.user.name || 'Customer',
          phone: req.user.phone,
          reason: suspiciousReason,
          bookingId: booking.bookingId,
          requestId: request.id,
        });
      }
    }

    res.status(201).json({ success: true, message: 'Cancel request submitted', request });
  } catch (error) {
    next(error);
  }
});

// ── Admin-side Routes ──

// GET /api/v1/booking-requests
router.get('/booking-requests', protect, async (req, res, next) => {
  try {
    const { status, userId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = parseInt(userId);

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

    // ── Real-time socket notification to user ──
    const io = req.app.get('io');
    if (io) {
      io.emit('booking-request-updated', {
        id: request.id,
        status,
        userId: request.userId,
        type: request.type,
        bookingId: request.booking?.bookingId || null,
        adminNote: status === 'rejected' ? (adminNote || '') : undefined,
      });
    }

    // ── SMS notification to user ──
    try {
      const settings = await req.repos.settingsRepo.get();
      const venueName = settings?.businessName || 'Indoor Arena';
      const userPhone = request.user?.phone;
      const bookingRef = request.booking?.bookingId || 'N/A';

      if (userPhone) {
        let smsMessage = '';

        if (status === 'approved') {
          if (request.type === 'cancel') {
            smsMessage = `[${venueName}] Your cancellation request for booking ${bookingRef} has been APPROVED. The booking is now cancelled. Thank you.`;
          } else {
            const rd = request.requestData || {};
            smsMessage = `[${venueName}] Your reschedule request for booking ${bookingRef} has been APPROVED. New schedule: ${rd.newDate} (${fmt12(rd.newStartTime)} - ${fmt12(rd.newEndTime)}). Thank you!`;
          }
        } else if (status === 'rejected') {
          const noteText = adminNote ? ` Reason: ${adminNote}` : '';
          smsMessage = `[${venueName}] Your ${request.type === 'cancel' ? 'cancellation' : 'reschedule'} request for booking ${bookingRef} has been REJECTED.${noteText} Contact us for more info.`;
        }

        if (smsMessage) {
          sendSMS(userPhone, smsMessage).catch(err => console.error('[SMS] Request notification failed:', err.message));
        }
      }
    } catch (smsErr) {
      console.error('[SMS] Error sending request notification:', smsErr.message);
    }

    const updated = await req.repos.bookingRequestRepo.findById(parseInt(id));
    res.status(200).json({ success: true, request: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
