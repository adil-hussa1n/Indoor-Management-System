import express from 'express';
import {
  submitContact,
  getMessages,
  updateMessageStatus,
  deleteMessage,
} from '../src/controllers/contact.controller.js';
import { protect } from '../src/middlewares/auth.js';

const router = express.Router();

// Public route
router.post('/contact', submitContact);

// Admin routes
router.get('/messages', protect, getMessages);
router.patch('/messages/:id', protect, updateMessageStatus);
router.delete('/messages/:id', protect, deleteMessage);

export default router;
