import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getFinancialSummary,
} from '../controllers/finance.controller.js';

const router = express.Router();

// All routes require Admin Authentication
router.use(protect);

// Category Management Routes
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Entry Management Routes (Investments & Expenses)
router.get('/entries', getEntries);
router.post('/entries', createEntry);
router.patch('/entries/:id', updateEntry);
router.delete('/entries/:id', deleteEntry);

// Financial Summary Route
router.get('/summary', getFinancialSummary);

export default router;
