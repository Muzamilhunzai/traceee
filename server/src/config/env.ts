/**
 * TraceNet — Environment Configuration
 * Loads .env once at process start, validates critical values,
 * and exposes a typed `env` object for the rest of the codebase.
 */
import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`[env] missing required variable: ${name}`);
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const JWT_SECRET = required('JWT_SECRET', 'tracenet-dev-secret-please-change');

// In production, refuse to boot with the dev secret.
if (
  NODE_ENV === 'production' &&
  JWT_SECRET === 'tracenet-dev-secret-please-change'
) {
  throw new Error('[env] JWT_SECRET must be set to a strong value in production.');
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '5000', 10),
  NODE_ENV,
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10),
} as const;