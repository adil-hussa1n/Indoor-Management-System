import jwt from 'jsonwebtoken';
import adminRepository from '../repositories/admin.repository.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production');
      const admin = await adminRepository.findById(decoded.id);
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
