import Gallery from '../models/Gallery.js';

class GalleryRepository {
  async findAll(options = {}) {
    return await Gallery.findAll({ order: [['createdAt', 'DESC']], ...options });
  }

  async findById(id) {
    return await Gallery.findByPk(id);
  }

  async create(data) {
    return await Gallery.create(data);
  }

  async count() {
    return await Gallery.count();
  }

  async delete(id) {
    const image = await Gallery.findByPk(id);
    if (!image) return null;
    await image.destroy();
    return image;
  }

  async updateOrder(id, order) {
    return await Gallery.update({ order }, { where: { id } });
  }
}

export default new GalleryRepository();
