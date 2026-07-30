import { createRepositories } from '../repositories/repository-factory.js';

/**
 * Injects tenant-scoped repositories into the request.
 * Must run AFTER tenant middleware.
 *
 * After this middleware, controllers can use:
 *   req.repos.bookingRepo, req.repos.slotRepo, req.repos.settingsRepo, etc.
 */
export const injectRepositories = (req, res, next) => {
  if (!req.models) {
    return res.status(500).json({
      success: false,
      message: 'Tenant context not initialized. Ensure tenant middleware runs first.',
    });
  }

  req.repos = createRepositories(req.models);
  next();
};

export default injectRepositories;
