import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginSchema } from '../../validators/auth.validator.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { sendLoginAlertEmail, sendStaffWelcomeEmail } from '../utils/mailer.js';

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

    // Dispatch Gmail SMTP Security Notification Alert
    const recipientEmail = admin.email || process.env.SMTP_USER;
    if (recipientEmail) {
      sendLoginAlertEmail({
        to: recipientEmail,
        name: admin.name || admin.username,
        role: admin.role === 'manager' ? 'Staff Manager' : 'Primary Venue Admin',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        device: req.headers['user-agent'] || 'Web Browser',
      }).catch(err => console.error('Gmail SMTP Login Alert Error:', err.message));
    }

    res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin.id,
        _id: admin.id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role || 'admin',
        permissions: admin.permissions || null,
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

// ── Staff & Manager Management Handlers ──

export const getStaff = async (req, res, next) => {
  try {
    const { adminRepo } = req.repos;
    const staffList = await adminRepo.findAll();

    const sanitized = staffList.map((a) => ({
      id: a.id,
      username: a.username,
      name: a.name || a.username,
      email: a.email || '',
      phone: a.phone || '',
      role: a.role || 'admin',
      permissions: a.permissions || null,
      createdAt: a.createdAt,
    }));

    res.status(200).json({ success: true, staff: sanitized });
  } catch (error) {
    next(error);
  }
};

export const createStaff = async (req, res, next) => {
  try {
    const { adminRepo } = req.repos;
    const { username, password, name, email, phone, role, permissions } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existing = await adminRepo.findByUsername(username.trim());
    if (existing) {
      return res.status(400).json({ success: false, message: 'A staff member with this username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPermissions = {
      bookings: true,
      requests: true,
      finances: false,
      grounds: true,
      settings: false,
      messages: true,
      auditLogs: false,
    };

    const newStaff = await adminRepo.create({
      username: username.trim(),
      password: hashedPassword,
      name: name ? name.trim() : username.trim(),
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      role: role === 'admin' ? 'admin' : 'manager',
      permissions: permissions || defaultPermissions,
    });

    await createAuditLog(req, {
      action: 'CREATE_STAFF_MANAGER',
      category: 'security',
      entity: 'Admin',
      entityId: newStaff.id,
      description: `Created new manager account "${newStaff.username}" (${newStaff.name})`,
    });

    // Dispatch Gmail SMTP Welcome Email to Staff Manager
    if (newStaff.email) {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const loginUrl = `${clientUrl}/admin/login?tenant=${req.tenant?.slug || ''}`;
      sendStaffWelcomeEmail({
        to: newStaff.email,
        name: newStaff.name,
        username: newStaff.username,
        tempPassword: password,
        role: newStaff.role === 'admin' ? 'Co-Admin' : 'Staff Manager',
        loginUrl,
      }).catch(err => console.error('Gmail SMTP Staff Welcome Email Error:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Staff manager account created successfully.',
      staff: {
        id: newStaff.id,
        username: newStaff.username,
        name: newStaff.name,
        email: newStaff.email,
        phone: newStaff.phone,
        role: newStaff.role,
        permissions: newStaff.permissions,
        createdAt: newStaff.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const { adminRepo } = req.repos;
    const { id } = req.params;
    const { password, name, email, phone, role, permissions } = req.body;

    const staff = await adminRepo.findById(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff manager account not found.' });
    }

    const updateData = {};
    if (password && password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }
    if (name !== undefined) updateData.name = name ? name.trim() : staff.username;
    if (email !== undefined) updateData.email = email ? email.trim() : null;
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (role) updateData.role = role;
    if (permissions !== undefined) updateData.permissions = permissions;

    await adminRepo.update(id, updateData);
    const updated = await adminRepo.findById(id);

    await createAuditLog(req, {
      action: 'UPDATE_STAFF_MANAGER',
      category: 'security',
      entity: 'Admin',
      entityId: staff.id,
      description: `Updated staff manager permissions/profile for "${staff.username}"`,
      oldValue: staff.toJSON(),
      newValue: updated.toJSON(),
    });

    res.status(200).json({
      success: true,
      message: 'Staff account updated successfully.',
      staff: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
        permissions: updated.permissions,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStaff = async (req, res, next) => {
  try {
    const { adminRepo } = req.repos;
    const { id } = req.params;

    const staff = await adminRepo.findById(id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff manager account not found.' });
    }

    // Protect primary admin from deleting themselves
    if (staff.id === req.admin.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own primary admin account.' });
    }

    await adminRepo.delete(id);

    await createAuditLog(req, {
      action: 'DELETE_STAFF_MANAGER',
      category: 'security',
      entity: 'Admin',
      entityId: staff.id,
      description: `Deleted staff manager account "${staff.username}"`,
    });

    res.status(200).json({ success: true, message: 'Staff manager account deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
