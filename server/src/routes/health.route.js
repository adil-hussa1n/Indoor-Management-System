import express from 'express';

const router = express.Router();

router.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    if (req.tenantDb) {
      await req.tenantDb.authenticate();
      dbStatus = 'connected';
    } else {
      dbStatus = 'no_tenant_context';
    }
  } catch (e) {
    dbStatus = `error: ${e.message}`;
  }

  res.status(200).json({
    success: true,
    server: 'running',
    tenant: req.tenant ? req.tenant.slug : null,
    database: dbStatus,
    version: '2.0.0',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

export default router;
