import 'dotenv/config';
import { sequelize, Slot } from '../models/index.js';

async function check() {
  try {
    await sequelize.authenticate();
    const slots = await Slot.findAll({ order: [['startTime', 'ASC']] });
    console.log(`Found ${slots.length} slots:`);
    for (let s of slots) {
      console.log(`ID: ${s.id} | Time: ${s.startTime} - ${s.endTime} | RateType: ${s.rateType} | DayOfWeek: ${s.dayOfWeek}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
