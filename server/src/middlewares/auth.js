import jwt from 'jsonwebtoken';

/**
 * Protect admin routes — verifies JWT and attaches req.admin.
 * Uses tenant-scoped models from req.repos (set by injectRepositories middleware).
 */
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Validate tenant scope to prevent cross-tenant session hijack / tab overlap
      if (decoded.tenant !== req.tenant.slug) {
        return res.status(401).json({ success: false, message: 'Not authorized, token tenant mismatch' });
      }

      // Use tenant-scoped admin repository
      const admin = await req.repos.adminRepo.findById(decoded.id);
      if (!admin) {
        return res.status(401).json({ success: false, message: 'Not authorized, admin not found' });
      }
      req.admin = { id: admin.id, _id: admin.id, username: admin.username };
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

/**
 * Protect user routes — verifies JWT and attaches req.user.
 * Uses tenant-scoped models from req.repos.
 */
export const protectUser = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type !== 'user') {
        return res.status(401).json({ success: false, message: 'Not authorized, invalid token type' });
      }

      // Validate tenant scope to prevent cross-tenant session hijack
      if (decoded.tenant !== req.tenant.slug) {
        return res.status(401).json({ success: false, message: 'Not authorized, token tenant mismatch' });
      }

      const user = await req.repos.userRepo.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      // Check if user's phone number is blocked
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
  } else {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

/**
 * Protect super admin routes — verifies JWT with superadmin type.
 */
export const protectSuperAdmin = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type !== 'superadmin') {
        return res.status(401).json({ success: false, message: 'Not authorized, requires super admin access' });
      }

      const { SuperAdmin } = await import('../models/master/index.js');
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
  } else {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};
