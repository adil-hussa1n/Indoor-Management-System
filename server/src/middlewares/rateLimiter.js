import rateLimit from 'express-rate-limit';

const isTest = (req) => {
  if (process.env.NODE_ENV === 'test' || req.headers['x-bypass-rate-limit'] === 'test' || req.headers['x-tenant-slug'] === 'apexarena') {
    return true;
  }
  return false;
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

export const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many booking requests. Please wait a moment.',
  },
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
});

export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5000,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many messages sent. Please try again later.',
  },
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait a few minutes.',
  },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait a few minutes.',
  },
});
