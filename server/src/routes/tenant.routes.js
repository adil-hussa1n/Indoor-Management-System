import express from 'express';
import {
  superAdminLogin,
  createTenant,
  listTenants,
  getTenant,
  updateTenant,
  deleteTenant,
} from '../controllers/tenant.controller.js';
import { protectSuperAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Public
router.post('/login', superAdminLogin);

// Protected (super admin only)
router.get('/tenants', protectSuperAdmin, listTenants);
router.post('/tenants', protectSuperAdmin, createTenant);
router.get('/tenants/:id', protectSuperAdmin, getTenant);
router.patch('/tenants/:id', protectSuperAdmin, updateTenant);
router.delete('/tenants/:id', protectSuperAdmin, deleteTenant);

export default router;
