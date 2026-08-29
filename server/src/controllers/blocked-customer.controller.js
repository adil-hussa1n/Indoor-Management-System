import { Op } from 'sequelize';
import { normalizePhone } from '../utils/phone.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { parsePagination, paginationMeta } from '../utils/paginate.js';

export const getBlockedCustomers = async (req, res, next) => {
  try {
    const { blockedCustomerRepo } = req.repos;
    const { search = '' } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const where = {};
    if (search) {
      where.phone = { [Op.like]: `%${search}%` };
    }

    const { count: total, rows: list } = await blockedCustomerRepo.findAndCountAll(where, {
      order: [['createdAt', 'DESC']],
      offset,
      limit,
    });

    // Convert Sequelize models to plain objects with _id alias
    const mapped = list.map(item => {
      const plain = item.toJSON();
      plain._id = plain.id;
      return plain;
    });

    res.status(200).json({ success: true, blockedCustomers: mapped, pagination: paginationMeta(total, { page, limit }) });
  } catch (error) {
    next(error);
  }
};

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

    createAuditLog(req, {
      action: 'BLOCK_CUSTOMER',
      category: 'blacklist',
      entity: 'BlockedCustomer',
      entityId: blocked.id,
      description: `Added phone '${normalizedPhone}' to blacklist (${reason || 'No reason specified'})`,
      newValue: blocked.toJSON ? blocked.toJSON() : blocked,
    }).catch(err => console.error(err));

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

    const oldValues = record.toJSON ? record.toJSON() : record;

    const updateData = {};
    if (reason !== undefined) updateData.reason = reason;
    if (isPermanent !== undefined) updateData.isPermanent = !!isPermanent;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    await blockedCustomerRepo.update(id, updateData);
    const updated = await blockedCustomerRepo.findById(id);

    createAuditLog(req, {
      action: 'UPDATE_BLOCK_RECORD',
      category: 'blacklist',
      entity: 'BlockedCustomer',
      entityId: updated.id,
      description: `Updated blacklist entry for '${updated.phone}'`,
      oldValue: oldValues,
      newValue: updated.toJSON ? updated.toJSON() : updated,
    }).catch(err => console.error(err));

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

    const oldValues = record.toJSON ? record.toJSON() : record;
    await blockedCustomerRepo.delete(id);

    createAuditLog(req, {
      action: 'UNBLOCK_CUSTOMER',
      category: 'blacklist',
      entity: 'BlockedCustomer',
      entityId: Number(id),
      description: `Removed phone '${record.phone}' from blacklist`,
      oldValue: oldValues,
    }).catch(err => console.error(err));

    res.status(200).json({ success: true, message: 'Phone number unblocked successfully.' });
  } catch (error) {
    next(error);
  }
};
