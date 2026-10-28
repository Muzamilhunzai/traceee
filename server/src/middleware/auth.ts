/**
 * TraceNet — Authentication Middleware
 * - authenticate : verifies the Bearer JWT, attaches `req.user`.
 * - requireRole  : role-based access control (RBAC).
 *
 * The token payload mirrors `AuthUser`, so downstream code
 * can access req.user.id / .role / .email without extra queries.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './errorHandler';

export type Role = 'admin' | 'detective' | 'analyst' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

// Augment Express.Request once for the whole app.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  const u = decoded as Partial<AuthUser>;
  if (typeof u.id !== 'number' || typeof u.email !== 'string' || typeof u.role !== 'string') {
    throw new ApiError(401, 'Malformed token payload');
  }
  return u as AuthUser;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authorization header missing or malformed');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new ApiError(401, 'Empty token');

    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new ApiError(401, 'Not authenticated'));
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Requires role: ${roles.join(', ')} (you are '${req.user.role}')`)
      );
    }
    next();
  };
}