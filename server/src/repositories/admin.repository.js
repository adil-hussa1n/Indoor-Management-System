import Admin from '../models/Admin.js';

class AdminRepository {
  async findByUsername(username) {
    return await Admin.findOne({ where: { username } });
  }

  async findById(id) {
    return await Admin.findByPk(id);
  }

  async create(adminData) {
    return await Admin.create(adminData);
  }
}

export default new AdminRepository();
