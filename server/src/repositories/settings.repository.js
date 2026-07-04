import Settings from '../models/Settings.js';

class SettingsRepository {
  async findOne(options = {}) {
    return await Settings.findOne(options);
  }

  async create(data) {
    return await Settings.create(data);
  }

  async getOrCreate() {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    return settings;
  }

  async update(settings, data) {
    return await settings.update(data);
  }
}

export default new SettingsRepository();
