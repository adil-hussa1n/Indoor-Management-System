/**
 * Records an audit log entry in the active tenant database.
 * @param {import('express').Request} req
 * @param {Object} options
 * @param {string} options.action - e.g. 'UPDATE_SETTINGS', 'MANAGE_SLOT'
 * @param {string} [options.category='general'] - e.g. 'settings', 'booking', 'slot', 'arena', 'review'
 * @param {string} [options.entity='System']
 * @param {number} [options.entityId=null]
 * @param {string} options.description - Readable log summary
 * @param {Object} [options.oldValue=null]
 * @param {Object} [options.newValue=null]
 */
export async function createAuditLog(req, { action, category = 'general', entity = 'System', entityId = null, description, oldValue = null, newValue = null }) {
  try {
    const models = req.tenantModels || req.models || (req.repos ? req.repos.models : null);
    if (!models || !models.AuditLog || !req.businessId) return;

    const adminUsername = req.user?.username || req.user?.name || req.admin?.username || 'Admin';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;

    try {
      await models.AuditLog.create({
        businessId: req.businessId,
        adminUsername,
        action,
        category,
        entity,
        entityId,
        description,
        oldValue,
        newValue: newValue || (description ? { summary: description } : null),
        ipAddress,
      });
    } catch (err1) {
      await models.AuditLog.create({
        businessId: req.businessId,
        action,
        entity,
        entityId,
        oldValue,
        newValue: newValue || (description ? { summary: description } : null),
        ipAddress,
      });
    }
  } catch (err) {
    console.error('Audit Logging Error Stack:', err);
  }
}
