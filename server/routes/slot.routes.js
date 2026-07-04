import express from 'express';
import {
  getAvailableSlots,
  getSlots,
  createSlot,
  updateSlot,
  deleteSlot,
} from '../src/controllers/slot.controller.js';
import { protect } from '../src/middlewares/auth.js';

const router = express.Router();

// Public routes
router.get('/available-slots', getAvailableSlots);

// Admin routes
router.get('/slots', protect, getSlots);
router.post('/slots', protect, createSlot);
router.patch('/slots/:id', protect, updateSlot);
router.delete('/slots/:id', protect, deleteSlot);

export default router;
