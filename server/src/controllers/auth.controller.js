import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginSchema } from '../../validators/auth.validator.js';
import { createAuditLog } from '../utils/auditLogger.js';

export const login = async (req, res, next) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const { username, password } = validation.data;
    const admin = await req.repos.adminRepo.findByUsername(username);

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: admin.id, tenant: req.tenant.slug, type: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    req.admin = { id: admin.id, username: admin.username };
    createAuditLog(req, {
      action: 'ADMIN_LOGIN',
      category: 'security',
      entity: 'Admin',
      entityId: admin.id,
      description: `Admin user '${admin.username}' logged into admin portal`,
    }).catch(err => console.error('Audit Log Error:', err.message));

    res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin.id,
        _id: admin.id,
        username: admin.username,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      admin: req.admin,
    });
  } catch (error) {
    next(error);
  }
};
