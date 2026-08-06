import express from 'express';
import {
  getGrounds,
  createGround,
  updateGround,
  reorderGrounds,
  deleteGround,
} from '../src/controllers/ground.controller.js';
import { protect } from '../src/middlewares/auth.js';

const router = express.Router();

// Public / User route
router.get('/grounds', getGrounds);

// Admin protected routes
router.patch('/grounds/reorder', protect, reorderGrounds);
router.post('/grounds', protect, createGround);
router.patch('/grounds/:id', protect, updateGround);
router.delete('/grounds/:id', protect, deleteGround);

export default router;
