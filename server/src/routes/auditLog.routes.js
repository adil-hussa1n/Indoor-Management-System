import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLog.controller.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.get('/', getAuditLogs);

export default router;
