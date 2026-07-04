import Slot from '../models/Slot.js';

class SlotRepository {
  async findAll(where = {}, options = {}) {
    return await Slot.findAll({ where, ...options });
  }

  async findById(id) {
    return await Slot.findByPk(id);
  }

  async create(data) {
    return await Slot.create(data);
  }

  async update(slot, data) {
    return await slot.update(data);
  }

  async delete(id) {
    const slot = await Slot.findByPk(id);
    if (!slot) return null;
    await slot.destroy();
    return slot;
  }
}

export default new SlotRepository();
