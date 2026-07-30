import { reviewSchema } from '../../validators/review.validator.js';

export const getApprovedReviews = async (req, res, next) => {
  try {
    const { reviewRepo } = req.repos;
    const reviews = await reviewRepo.findAll({ isApproved: true });
    const mapped = reviews.map(r => { const p = r.toJSON(); p._id = p.id; return p; });
    res.status(200).json({ success: true, reviews: mapped });
  } catch (error) {
    next(error);
  }
};

export const createReview = async (req, res, next) => {
  try {
    const { reviewRepo } = req.repos;
    const validation = reviewSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const review = await reviewRepo.create(validation.data);

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

export const getAllReviews = async (req, res, next) => {
  try {
    const { reviewRepo } = req.repos;
    const reviews = await reviewRepo.findAll();
    const mapped = reviews.map(r => { const p = r.toJSON(); p._id = p.id; return p; });
    res.status(200).json({ success: true, reviews: mapped });
  } catch (error) {
    next(error);
  }
};

export const updateReviewStatus = async (req, res, next) => {
  try {
    const { reviewRepo } = req.repos;
    const { id } = req.params;
    const { isApproved, isFeatured } = req.body;

    const review = await reviewRepo.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const updateData = {};
    if (isApproved !== undefined) updateData.isApproved = isApproved;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

    await reviewRepo.update(id, updateData);
    const updated = await reviewRepo.findById(id);
    const plain = updated.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, review: plain });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const { reviewRepo } = req.repos;
    const { id } = req.params;
    const review = await reviewRepo.delete(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    res.status(200).json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    next(error);
  }
};
