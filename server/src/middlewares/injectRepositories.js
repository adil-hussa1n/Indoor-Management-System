import { createModels } from '../models/model-factory.js';
import { sequelize } from '../config/db.js';
import { createRepositories } from '../repositories/repository-factory.js';
import { withBusinessScope } from '../repositories/scope.js';

// Models are defined exactly once, at first use, against the single shared
// connection (constitution Principle I.1 / research.md Decision 1) — not
// per-request the way the old per-tenant model-factory invocation worked.
const models = createModels(sequelize);

/**
 * Injects business-scoped repositories into the request.
 * Must run AFTER businessContext (server/src/middlewares/businessContext.js),
 * which sets req.businessId.
 *
 * After this middleware, controllers can use:
 *   req.repos.bookingRepo, req.repos.slotRepo, req.repos.settingsRepo, etc.
 * — every method call is automatically scoped to req.businessId
 * (server/src/repositories/scope.js).
 */
export const injectRepositories = (req, res, next) => {
  if (!req.businessId) {
    return res.status(500).json({
      success: false,
      message: 'Business context not initialized. Ensure businessContext middleware runs first.',
    });
  }

  req.models = models;
  req.repos = withBusinessScope(createRepositories(models), req.businessId);
  next();
};

export default injectRepositories;
