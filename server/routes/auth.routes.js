import express from 'express';
import { login, sendAdminOTP, verifyAdminOTP, getMe, getStaff, createStaff, updateStaff, deleteStaff } from '../src/controllers/auth.controller.js';
import { protect, requirePrimaryAdmin } from '../src/middlewares/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/send-otp', sendAdminOTP);
router.post('/verify-otp', verifyAdminOTP);
router.get('/me', protect, getMe);

// Staff & Manager Management (Primary Admin Only)
router.get('/staff', protect, requirePrimaryAdmin, getStaff);
router.post('/staff', protect, requirePrimaryAdmin, createStaff);
router.patch('/staff/:id', protect, requirePrimaryAdmin, updateStaff);
router.delete('/staff/:id', protect, requirePrimaryAdmin, deleteStaff);

export default router;
