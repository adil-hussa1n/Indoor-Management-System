import jwt from 'jsonwebtoken';
import SuperAdmin from '../models/SuperAdmin.js';
import { extractToken } from '../utils/authCookie.js';

/**
 * Protect admin routes — attaches req.admin from the identity already
 * decoded by businessContext (server/src/middlewares/businessContext.js,
 * which must run first and sets req.jwtDecoded + req.businessId).
 * Uses business-scoped repositories from req.repos (injectRepositories).
 */
export const protect = async (req, res, next) => {
  const decoded = req.jwtDecoded;
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    if (decoded.type !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid token type' });
    }

    // Defense-in-depth replay check: the business the token names must
    // match the business businessContext already resolved from that same
    // token (research.md — mirrors the old tenant-mismatch check).
    if (decoded.businessId !== req.businessId) {
      return res.status(401).json({ success: false, message: 'Not authorized, token business mismatch' });
    }

    const admin = await req.repos.adminRepo.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Not authorized, admin not found' });
    }
    req.admin = {
      id: admin.id,
      _id: admin.id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role || 'admin',
      permissions: admin.permissions || null,
    };
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

/**
 * Require a specific module permission for managers/staff.
 * Primary admins (role === 'admin') automatically bypass all permission checks.
 */
export const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.admin.role === 'admin') {
      return next();
    }
    if (req.admin.permissions && req.admin.permissions[permissionKey] === true) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Access denied. You do not have permission to access the "${permissionKey}" module.`,
    });
  };
};

/**
 * Restrict endpoints to primary business owners (owners) only.
 */
export const requirePrimaryAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (req.admin.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only the primary business owner can manage staff accounts.',
    });
  }
  next();
};

/**
 * Protect user (customer) routes — attaches req.user from the identity
 * already decoded by businessContext.
 * Uses business-scoped repositories from req.repos.
 */
export const protectUser = async (req, res, next) => {
  const decoded = req.jwtDecoded;
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    if (decoded.type !== 'user') {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid token type' });
    }

    if (decoded.businessId !== req.businessId) {
      return res.status(401).json({ success: false, message: 'Not authorized, token business mismatch' });
    }

    const user = await req.repos.userRepo.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }

    const isBlocked = await req.repos.blockedCustomerRepo.isBlocked(user.phone);
    if (isBlocked) {
      return res.status(401).json({ success: false, message: 'Not authorized, this phone number has been suspended.' });
    }

    req.user = { id: user.id, uuid: user.uuid, name: user.name, phone: user.phone, email: user.email };
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

/**
 * Protect super admin routes — verifies JWT with superadmin type.
 * Unrelated to per-business scoping (Super Admin is platform-wide), so this
 * continues to decode its own JWT directly rather than going through
 * businessContext, which is only mounted under /api/v1 (see app.js).
 */
export const protectSuperAdmin = async (req, res, next) => {
  const token = extractToken(req, 'superadmin');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'superadmin') {
      return res.status(401).json({ success: false, message: 'Not authorized, requires super admin access' });
    }

    const superAdmin = await SuperAdmin.findByPk(decoded.id);
    if (!superAdmin) {
      return res.status(401).json({ success: false, message: 'Not authorized, super admin not found' });
    }
    req.superAdmin = { id: superAdmin.id, username: superAdmin.username, role: superAdmin.role };
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};
