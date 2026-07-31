import express from 'express';
import { protectUser } from '../middlewares/auth.js';
import { sendSMS } from '../utils/sms.js';
import { normalizePhone } from '../utils/phone.js';
import { Op } from 'sequelize';

const router = express.Router();

// POST /api/v1/user/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhone(phone);

    // Check if the phone number is suspended/blacklisted
    const isBlocked = await req.repos.blockedCustomerRepo.isBlocked(normalizedPhone);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'This phone number has been suspended from making reservations. Please contact support.',
      });
    }

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP using normalized phone
    await req.repos.otpRepo.create({ phone: normalizedPhone, code, expiresAt });

    // Send OTP via SMS API (BulkSMSBD / SSLWireless / Mock fallback)
    const smsMessage = `Your OTP for login is ${code}. It is valid for 5 minutes.`;
    const customCredentials = req.tenant?.smsCredentials;
    
    await sendSMS(normalizedPhone, smsMessage, customCredentials);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV !== 'production' && { devOtp: code }), // Only in dev
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/user/verify-otp
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required' });
    }

    const normalizedPhone = normalizePhone(phone);

    // Double check blacklist on verification
    const isBlocked = await req.repos.blockedCustomerRepo.isBlocked(normalizedPhone);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'This phone number has been suspended from making reservations. Please contact support.',
      });
    }

    const otp = await req.repos.otpRepo.findLatest(normalizedPhone);
    if (!otp) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found' });
    }

    if (otp.attempts >= 5) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
    }

    if (otp.code !== code) {
      await req.repos.otpRepo.incrementAttempts(otp.id);
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Mark OTP as used
    await req.repos.otpRepo.markUsed(otp.id);

    // Find matching users (could be multiple due to historical phone formats)
    const localPhone = normalizedPhone.replace(/^88/, '');
    const matchingUsers = await req.tenantDb.models.User.findAll({
      where: {
        phone: [normalizedPhone, localPhone]
      }
    });

    let user = null;
    if (matchingUsers.length === 0) {
      // Create new user
      user = await req.repos.userRepo.create({ phone: normalizedPhone, isVerified: true });
    } else {
      // Find the user that already has the normalized phone format, if any
      const normalizedUser = matchingUsers.find(u => u.phone === normalizedPhone);
      if (normalizedUser) {
        user = normalizedUser;
        // Verify it if not already
        if (!user.isVerified) {
          await req.repos.userRepo.update(user.id, { isVerified: true });
        }
        
        // Merge other duplicate accounts into this one
        const duplicates = matchingUsers.filter(u => u.id !== user.id);
        for (const dup of duplicates) {
          // Re-link bookings from duplicate userId to main user.id
          await req.tenantDb.models.Booking.update(
            { userId: user.id },
            { where: { userId: dup.id } }
          );
          await req.tenantDb.models.BookingRequest.update(
            { userId: user.id },
            { where: { userId: dup.id } }
          );
          // Delete duplicate user
          await req.tenantDb.models.User.destroy({ where: { id: dup.id } });
        }
      } else {
        // None are normalized, take the first one and normalize it
        user = matchingUsers[0];
        const updates = { phone: normalizedPhone };
        if (!user.isVerified) updates.isVerified = true;
        await req.repos.userRepo.update(user.id, updates);
        // Refresh reference
        user = await req.repos.userRepo.findById(user.id);
      }
    }

    // Link any bookings matching this user's phone formats to their user ID
    const bookingsToUpdate = await req.tenantDb.models.Booking.findAll({
      attributes: ['id'],
      where: {
        [Op.or]: [
          { phone: normalizedPhone },
          { phone: localPhone },
        ]
      }
    });

    if (bookingsToUpdate.length > 0) {
      const bookingIds = bookingsToUpdate.map(b => b.id);
      await req.tenantDb.models.Booking.update(
        { userId: user.id, phone: normalizedPhone },
        { where: { id: { [Op.in]: bookingIds } } }
      );
      await req.tenantDb.models.BookingRequest.update(
        { userId: user.id },
        { where: { bookingId: { [Op.in]: bookingIds } } }
      );
    }

    // Generate JWT
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { id: user.id, tenant: req.tenant.slug, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      user: { id: user.id, uuid: user.uuid, name: user.name, phone: user.phone, email: user.email },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/user/me
router.get('/me', protectUser, async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// PATCH /api/v1/user/me
router.patch('/me', protectUser, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email === '' ? null : email;

    await req.repos.userRepo.update(req.user.id, updateData);
    const updated = await req.repos.userRepo.findById(req.user.id);

    res.status(200).json({
      success: true,
      user: { id: updated.id, uuid: updated.uuid, name: updated.name, phone: updated.phone, email: updated.email },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/user/my-bookings
router.get('/my-bookings', protectUser, async (req, res, next) => {
  try {
    const bookings = await req.repos.bookingRepo.findByUserId(req.user.id);
    res.status(200).json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
});

export default router;
