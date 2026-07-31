import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Routes (keep same route files, but update controller imports inside them)
import authRoutes from './routes/auth.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import slotRoutes from './routes/slot.routes.js';
import galleryRoutes from './routes/gallery.routes.js';
import reviewRoutes from './routes/review.routes.js';
import contactRoutes from './routes/contact.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import blockedCustomerRoutes from './routes/blocked-customer.routes.js';
import healthRoutes from './src/routes/health.route.js';
import tenantRoutes from './src/routes/tenant.routes.js';
import userAuthRoutes from './src/routes/user-auth.routes.js';
import bookingRequestRoutes from './src/routes/booking-request.routes.js';

import { errorHandler } from './src/middlewares/errorHandler.js';
import { apiLimiter, bookingLimiter, loginLimiter, contactLimiter, otpLimiter, otpVerifyLimiter } from './src/middlewares/rateLimiter.js';
import { tenantMiddleware } from './src/middlewares/tenant.js';
import { injectRepositories } from './src/middlewares/injectRepositories.js';

dotenv.config();

const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = [
        process.env.CLIENT_URL,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174'
      ];
      // In development, allow all origins; in production, check whitelist + subdomains
      if (allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        // Allow any subdomain of the configured domain
        const baseHost = process.env.BASE_DOMAIN || '';
        if (baseHost && origin.endsWith(baseHost)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Versioned APIs (v1)
const apiPrefix = '/api/v1';

// ── Super Admin Routes (no tenant middleware needed) ──
app.use('/api/master', tenantRoutes);

// ── Tenant-scoped Routes ──
// All /api/v1/* routes go through tenant middleware + repository injection
app.use(`${apiPrefix}`, tenantMiddleware, injectRepositories);

// Specialized Rate Limiters per route
app.use(`${apiPrefix}/booking`, bookingLimiter);
app.use(`${apiPrefix}/auth/login`, loginLimiter);
app.use(`${apiPrefix}/contact`, contactLimiter);
app.use(`${apiPrefix}/reviews`, apiLimiter);
app.use(`${apiPrefix}/user/send-otp`, otpLimiter);
app.use(`${apiPrefix}/user/verify-otp`, otpVerifyLimiter);

// Register tenant-scoped routes
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}`, bookingRoutes);
app.use(`${apiPrefix}`, slotRoutes);
app.use(`${apiPrefix}`, galleryRoutes);
app.use(`${apiPrefix}`, reviewRoutes);
app.use(`${apiPrefix}`, contactRoutes);
app.use(`${apiPrefix}`, settingsRoutes);
app.use(`${apiPrefix}`, blockedCustomerRoutes);
app.use(`${apiPrefix}/user`, userAuthRoutes);
app.use(`${apiPrefix}`, bookingRequestRoutes);

// Health check
app.use(`${apiPrefix}`, healthRoutes);

// Base route
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Indoor Management System API (Multi-Tenant)' });
});

// Error handling middleware
app.use(errorHandler);

export default app;
