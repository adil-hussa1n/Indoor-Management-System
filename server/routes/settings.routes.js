import express from 'express';
import multer from 'multer';
import {
  getSettings,
  updateSettings,
  getPublicInfo,
} from '../controllers/settings.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for video support
});

// Public route
router.get('/info', getPublicInfo);

// Admin routes
router.get('/settings', protect, getSettings);
router.patch(
  '/settings',
  protect,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'heroBanner', maxCount: 1 },
  ]),
  updateSettings
);

export default router;
