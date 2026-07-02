import Review from '../models/Review.js';
import { reviewSchema } from '../validators/review.validator.js';

// Public Reviews
export const getApprovedReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ isApproved: true }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, reviews });
  } catch (error) {
    next(error);
  }
};

export const createReview = async (req, res, next) => {
  try {
    const validation = reviewSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const review = await Review.create(validation.data);

    const io = req.app.get('io');
    if (io) {
      io.emit('new-review', review);
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted and pending approval.',
      review,
    });
  } catch (error) {
    next(error);
  }
};

// Admin Reviews CRUD
export const getAllReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, reviews });
  } catch (error) {
    next(error);
  }
};

export const updateReviewStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isApproved, isFeatured } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (isApproved !== undefined) review.isApproved = isApproved;
    if (isFeatured !== undefined) review.isFeatured = isFeatured;

    await review.save();
    res.status(200).json({ success: true, review });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await Review.findByIdAndDelete(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    res.status(200).json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    next(error);
  }
};
