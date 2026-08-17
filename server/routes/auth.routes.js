import express from 'express';
import { login, getMe, getStaff, createStaff, updateStaff, deleteStaff } from '../src/controllers/auth.controller.js';
import { protect, requirePrimaryAdmin } from '../src/middlewares/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);

// Staff & Manager Management (Primary Admin Only)
router.get('/staff', protect, requirePrimaryAdmin, getStaff);
router.post('/staff', protect, requirePrimaryAdmin, createStaff);
router.patch('/staff/:id', protect, requirePrimaryAdmin, updateStaff);
router.delete('/staff/:id', protect, requirePrimaryAdmin, deleteStaff);

export default router;
