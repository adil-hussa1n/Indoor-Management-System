export const getBlockedCustomers = async (req, res, next) => {
  try {
    const { blockedCustomerRepo } = req.repos;
    const list = await blockedCustomerRepo.findAll({}, { order: [['createdAt', 'DESC']] });
    
    // Convert Sequelize models to plain objects with _id alias
    const mapped = list.map(item => {
      const plain = item.toJSON();
      plain._id = plain.id;
      return plain;
    });

    res.status(200).json({ success: true, blockedCustomers: mapped });
  } catch (error) {
    next(error);
  }
};

import { normalizePhone } from '../utils/phone.js';

export const blockCustomer = async (req, res, next) => {
  try {
    const { blockedCustomerRepo } = req.repos;
    const { phone, reason, isPermanent, expiresAt } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const normalizedPhone = normalizePhone(phone);

    // Check if already blocked
    const existing = await blockedCustomerRepo.findByPhone(normalizedPhone);
    if (existing) {
      return res.status(400).json({ success: false, message: 'This phone number is already blocked.' });
    }

    const blocked = await blockedCustomerRepo.create({
      phone: normalizedPhone,
      reason: reason || null,
      isPermanent: isPermanent !== undefined ? !!isPermanent : true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    const plain = blocked.toJSON();
    plain._id = plain.id;

    res.status(201).json({ success: true, blockedCustomer: plain });
  } catch (error) {
    next(error);
  }
};

export const updateBlock = async (req, res, next) => {
  try {
    const { blockedCustomerRepo } = req.repos;
    const { id } = req.params;
    const { reason, isPermanent, expiresAt } = req.body;

    const record = await blockedCustomerRepo.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Block record not found.' });
    }

    const updateData = {};
    if (reason !== undefined) updateData.reason = reason;
    if (isPermanent !== undefined) updateData.isPermanent = !!isPermanent;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    await blockedCustomerRepo.update(id, updateData);
    const updated = await blockedCustomerRepo.findById(id);

    const plain = updated.toJSON();
    plain._id = plain.id;

    res.status(200).json({ success: true, blockedCustomer: plain });
  } catch (error) {
    next(error);
  }
};

export const unblockCustomer = async (req, res, next) => {
  try {
    const { blockedCustomerRepo } = req.repos;
    const { id } = req.params;

    const record = await blockedCustomerRepo.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Block record not found.' });
    }

    await blockedCustomerRepo.delete(id);
    res.status(200).json({ success: true, message: 'Customer successfully unblocked.' });
  } catch (error) {
    next(error);
  }
};
