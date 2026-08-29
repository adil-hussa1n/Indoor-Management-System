import { Op } from 'sequelize';
import { contactSchema } from '../../validators/contact.validator.js';
import { sanitizeFields } from '../utils/sanitize.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { parsePagination, paginationMeta } from '../utils/paginate.js';

export const submitContact = async (req, res, next) => {
  try {
    const { contactRepo } = req.repos;
    const validation = contactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const sanitizedData = sanitizeFields(validation.data, ['name', 'email', 'phone', 'message']);
    const contact = await contactRepo.create(sanitizedData);

    const io = req.app.get('io');
    if (io) {
      io.emit('new-message', contact);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully. We will get back to you soon!',
      contact,
    });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { contactRepo } = req.repos;
    const { search = '' } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count: total, rows: messages } = await contactRepo.findAndCountAll(where, { offset, limit });
    const mapped = messages.map(m => { const p = m.toJSON(); p._id = p.id; return p; });
    res.status(200).json({ success: true, messages: mapped, pagination: paginationMeta(total, { page, limit }) });
  } catch (error) {
    next(error);
  }
};

export const updateMessageStatus = async (req, res, next) => {
  try {
    const { contactRepo } = req.repos;
    const { id } = req.params;
    const { isRead, replyStatus } = req.body;

    const message = await contactRepo.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const oldValues = message.toJSON ? message.toJSON() : message;

    const updateData = {};
    if (isRead !== undefined) updateData.isRead = isRead;
    if (replyStatus !== undefined) updateData.replyStatus = replyStatus;

    await contactRepo.update(id, updateData);
    const updated = await contactRepo.findById(id);

    createAuditLog(req, {
      action: 'UPDATE_MESSAGE_STATUS',
      category: 'messages',
      entity: 'ContactMessage',
      entityId: updated.id,
      description: `Updated status for message from '${updated.name}'`,
      oldValue: oldValues,
      newValue: updated.toJSON ? updated.toJSON() : updated,
    }).catch(err => console.error(err));

    const plain = updated.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, message: plain });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { contactRepo } = req.repos;
    const { id } = req.params;

    const existing = await contactRepo.findById(id);
    const oldValues = existing ? (existing.toJSON ? existing.toJSON() : existing) : null;

    const message = await contactRepo.delete(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    createAuditLog(req, {
      action: 'DELETE_MESSAGE',
      category: 'messages',
      entity: 'ContactMessage',
      entityId: Number(id),
      description: `Deleted customer message #${id}`,
      oldValue: oldValues,
    }).catch(err => console.error(err));

    res.status(200).json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
};
