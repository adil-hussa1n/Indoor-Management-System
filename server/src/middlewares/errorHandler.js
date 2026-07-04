export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  // Handle Sequelize UniqueConstraintError (duplicate entry)
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = 'This time slot is already booked or a duplicate entry was detected.';
  }

  // Handle Sequelize ForeignKeyConstraintError
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Referenced resource not found or cannot be deleted.';
  }

  // Handle Sequelize ValidationError
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = err.errors?.map(e => e.message).join(', ') || err.message;
  }

  // Handle Sequelize OptimisticLockError
  if (err.name === 'SequelizeOptimisticLockError') {
    statusCode = 409;
    message = 'This record was modified by another user. Please refresh and try again.';
  }

  // Handle Sequelize DatabaseError (general MySQL errors)
  if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'A database error occurred. Please try again later.';
    console.error('MySQL Error:', err.original?.sqlMessage || err.message);
  }

  // Handle Zod or custom validation errors
  if (err.name === 'ValidationError' || err.errors) {
    statusCode = 400;
    message = err.errors || err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
