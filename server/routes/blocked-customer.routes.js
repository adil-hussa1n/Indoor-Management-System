import express from 'express';
import {
  getBlockedCustomers,
  blockCustomer,
  updateBlock,
  unblockCustomer,
} from '../src/controllers/blocked-customer.controller.js';
import { protect } from '../src/middlewares/auth.js';

const router = express.Router();

router.get('/blocked-customers', protect, getBlockedCustomers);
router.post('/blocked-customers', protect, blockCustomer);
router.patch('/blocked-customers/:id', protect, updateBlock);
router.delete('/blocked-customers/:id', protect, unblockCustomer);

export default router;
