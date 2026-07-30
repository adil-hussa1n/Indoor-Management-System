import express from 'express';
import { protectUser } from '../middlewares/auth.js';
import { sendSMS } from '../utils/sms.js';

const router = express.Router();

// POST /api/v1/user/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP
    await req.repos.otpRepo.create({ phone, code, expiresAt });

    // Send OTP via SMS API (BulkSMSBD / SSLWireless / Mock fallback)
    const smsMessage = `Your OTP for login is ${code}. It is valid for 5 minutes.`;
    const customCredentials = req.tenant?.smsCredentials;
    
    await sendSMS(phone, smsMessage, customCredentials);

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

    const otp = await req.repos.otpRepo.findLatest(phone);
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

    // Find or create user
    let user = await req.repos.userRepo.findByPhone(phone);
    if (!user) {
      user = await req.repos.userRepo.create({ phone, isVerified: true });
    } else if (!user.isVerified) {
      await req.repos.userRepo.update(user.id, { isVerified: true });
    }

    // Generate JWT
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { id: user.id, tenant: req.tenant.slug, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }
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
    if (email !== undefined) updateData.email = email;

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
