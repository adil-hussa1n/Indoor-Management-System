import Contact from '../models/Contact.js';

class ContactRepository {
  async findAll(options = {}) {
    return await Contact.findAll({ order: [['createdAt', 'DESC']], ...options });
  }

  async findById(id) {
    return await Contact.findByPk(id);
  }

  async create(data) {
    return await Contact.create(data);
  }

  async update(contact, data) {
    return await contact.update(data);
  }

  async delete(id) {
    const contact = await Contact.findByPk(id);
    if (!contact) return null;
    await contact.destroy();
    return contact;
  }
}

export default new ContactRepository();
