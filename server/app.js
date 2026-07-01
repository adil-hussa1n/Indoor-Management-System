import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import slotRoutes from './routes/slot.routes.js';
import galleryRoutes from './routes/gallery.routes.js';
import reviewRoutes from './routes/review.routes.js';
import contactRoutes from './routes/contact.routes.js';
import settingsRoutes from './routes/settings.routes.js';

import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

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
      if (allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
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

// Rate Limiter applied to public facing submissions
app.use(`${apiPrefix}/booking`, apiLimiter);
app.use(`${apiPrefix}/contact`, apiLimiter);
app.use(`${apiPrefix}/reviews`, apiLimiter);

// Register routes
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}`, bookingRoutes);
app.use(`${apiPrefix}`, slotRoutes);
app.use(`${apiPrefix}`, galleryRoutes);
app.use(`${apiPrefix}`, reviewRoutes);
app.use(`${apiPrefix}`, contactRoutes);
app.use(`${apiPrefix}`, settingsRoutes);

// Base route
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Apex Indoor Sports API is running' });
});

// Error handling middleware
app.use(errorHandler);

export default app;
