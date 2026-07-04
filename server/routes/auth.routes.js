import express from 'express';
import { login, getMe } from '../src/controllers/auth.controller.js';
import { protect } from '../src/middlewares/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);

export default router;
