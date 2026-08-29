import express from 'express';
import { sequelize } from '../config/db.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await sequelize.authenticate();
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = `error: ${e.message}`;
  }

  res.status(200).json({
    success: true,
    server: 'running',
    business: req.business ? req.business.slug : null,
    database: dbStatus,
    version: '2.0.0',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

export default router;
