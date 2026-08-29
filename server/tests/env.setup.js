// Loaded by Jest before the test suite runs (see jest.config.js `setupFiles`).
// Points the app at a dedicated test database so the isolation suite never
// touches development/production data, per research.md Decision 5.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'indoor_management_test';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'test-only-jwt-secret-do-not-use-in-prod-xxxxx';
}
