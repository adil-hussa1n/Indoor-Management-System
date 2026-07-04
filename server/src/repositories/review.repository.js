import Review from '../models/Review.js';

class ReviewRepository {
  async findAll(where = {}, options = {}) {
    return await Review.findAll({ where, order: [['createdAt', 'DESC']], ...options });
  }

  async findById(id) {
    return await Review.findByPk(id);
  }

  async create(data) {
    return await Review.create(data);
  }

  async update(review, data) {
    return await review.update(data);
  }

  async delete(id) {
    const review = await Review.findByPk(id);
    if (!review) return null;
    await review.destroy(); // Soft delete (paranoid)
    return review;
  }
}

export default new ReviewRepository();
