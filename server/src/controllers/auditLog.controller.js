export const getAuditLogs = async (req, res, next) => {
  try {
    const models = req.tenantModels || req.models;
    if (!models || !models.AuditLog) {
      return res.status(200).json({ success: true, logs: [], total: 0 });
    }

    const { category, search, page = 1, limit = 50 } = req.query;
    const { Op } = models.sequelize || {};

    const hasCategory = !!models.AuditLog.rawAttributes.category;
    const hasAdminUsername = !!models.AuditLog.rawAttributes.adminUsername;
    const hasDescription = !!models.AuditLog.rawAttributes.description;

    const where = {};
    if (category && category !== 'all' && hasCategory) {
      where.category = category;
    }

    if (search && Op) {
      const q = `%${search.trim()}%`;
      const searchConditions = [{ action: { [Op.like]: q } }];
      if (hasDescription) searchConditions.push({ description: { [Op.like]: q } });
      if (hasAdminUsername) searchConditions.push({ adminUsername: { [Op.like]: q } });
      where[Op.or] = searchConditions;
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await models.AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
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
      total: count,
      page: Number(page),
      totalPages: Math.ceil(count / Number(limit)) || 1,
    });
  } catch (error) {
    console.error('[AuditLog Controller Error]:', error);
    res.status(200).json({ success: true, logs: [], total: 0, page: 1, totalPages: 1 });
  }
};
