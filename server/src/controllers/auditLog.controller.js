import { Op } from 'sequelize';
import { parsePagination, paginationMeta } from '../utils/paginate.js';

export const getAuditLogs = async (req, res, next) => {
  try {
    const { auditLogRepo } = req.repos;
    if (!auditLogRepo) {
      return res.status(200).json({ success: true, logs: [], total: 0 });
    }

    const { category, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const where = {};
    if (category && category !== 'all') {
      where.category = category;
    }

    if (search) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { action: { [Op.like]: q } },
        { description: { [Op.like]: q } },
        { adminUsername: { [Op.like]: q } },
      ];
    }

    const { count, rows } = await auditLogRepo.findAndCountAll(where, {
      order: [['createdAt', 'DESC']],
      offset,
      limit,
    });

    const logs = (rows || []).map(item => {
      const plain = item.toJSON ? item.toJSON() : item;
      return {
        id: plain.id,
        adminUsername: plain.adminUsername || (plain.userId ? `Admin #${plain.userId}` : 'Admin'),
        action: plain.action,
        category: plain.category || 'general',
        entity: plain.entity || 'System',
        entityId: plain.entityId,
        description: plain.description || (plain.newValue?.summary ? plain.newValue.summary : `${plain.action} performed`),
        oldValue: plain.oldValue,
        newValue: plain.newValue,
        ipAddress: plain.ipAddress || '—',
        createdAt: plain.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      logs,
      ...paginationMeta(count, { page, limit }),
    });
  } catch (error) {
    console.error('[AuditLog Controller Error]:', error);
    res.status(200).json({ success: true, logs: [], total: 0, page: 1, totalPages: 1 });
  }
};
