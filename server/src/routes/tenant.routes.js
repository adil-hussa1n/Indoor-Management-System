import express from 'express';
import {
  superAdminLogin,
  superAdminLogout,
  sendSuperAdminOTP,
  verifySuperAdminOTP,
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
router.post('/send-otp', sendSuperAdminOTP);
router.post('/verify-otp', verifySuperAdminOTP);
router.post('/logout', protectSuperAdmin, superAdminLogout);

// Protected (super admin only)
router.get('/tenants', protectSuperAdmin, listTenants);
router.post('/tenants', protectSuperAdmin, createTenant);
router.get('/tenants/:id', protectSuperAdmin, getTenant);
router.patch('/tenants/:id', protectSuperAdmin, updateTenant);
router.delete('/tenants/:id', protectSuperAdmin, deleteTenant);

export default router;
