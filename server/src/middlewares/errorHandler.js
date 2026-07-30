export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  // Handle Sequelize UniqueConstraintError (duplicate entry)
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    const firstError = err.errors?.[0];
    if (firstError) {
      const path = firstError.path;
      const modelName = firstError.model?.name || firstError.instance?.constructor?.name;
      if (path === 'slug') {
        message = 'This subdomain slug is already taken by another business.';
      } else if (path === 'customDomain') {
        message = 'This custom domain is already in use by another business.';
      } else if (path === 'username' && (modelName === 'Admin' || modelName === 'admins')) {
        message = 'This administrator username is already registered.';
      } else if (path === 'phone' && (modelName === 'User' || modelName === 'users')) {
        message = 'This phone number is already registered to a user account.';
      } else if (path === 'bookingId') {
        message = 'A booking with this ID already exists.';
      } else {
        message = firstError.message || 'A duplicate entry was detected.';
      }
    } else {
      message = 'A duplicate entry was detected.';
    }
  }
  // Handle Sequelize ForeignKeyConstraintError
  else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Referenced resource not found or cannot be deleted.';
  }
  // Handle Sequelize ValidationError
  else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = err.errors?.map(e => e.message).join(', ') || err.message;
  }
  // Handle Sequelize OptimisticLockError
  else if (err.name === 'SequelizeOptimisticLockError') {
    statusCode = 409;
    message = 'This record was modified by another user. Please refresh and try again.';
  }
  // Handle Sequelize DatabaseError (general MySQL errors)
  else if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'A database error occurred. Please try again later.';
    console.error('MySQL Error:', err.original?.sqlMessage || err.message);
  }
  // Handle Zod or custom validation errors
  else if (err.name === 'ValidationError' || err.errors) {
    statusCode = 400;
    message = typeof err.errors === 'string' ? err.errors : (err.errors?.map?.(e => e.message).join(', ') || err.message);
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
