import express from 'express';
import {
  getApprovedReviews,
  createReview,
  getAllReviews,
  updateReviewStatus,
  deleteReview,
} from '../src/controllers/review.controller.js';
import { protect } from '../src/middlewares/auth.js';

const router = express.Router();

// Public routes
router.get('/reviews', getApprovedReviews);
router.post('/reviews', createReview);

// Admin routes
router.get('/reviews/all', protect, getAllReviews);
router.patch('/reviews/:id', protect, updateReviewStatus);
router.delete('/reviews/:id', protect, deleteReview);

export default router;
