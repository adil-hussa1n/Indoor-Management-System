import express from 'express';
import multer from 'multer';
import {
  getGallery,
  uploadImage,
  deleteImage,
  reorderGallery,
} from '../src/controllers/gallery.controller.js';
import { protect } from '../src/middlewares/auth.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Public route
router.get('/gallery', getGallery);

// Admin routes
router.post('/gallery', protect, upload.single('image'), uploadImage);
router.delete('/gallery/:id', protect, deleteImage);
router.post('/gallery/reorder', protect, reorderGallery);

export default router;
