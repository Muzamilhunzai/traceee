/**
 * TraceNet — Auth Controller
 * Endpoints:
 *   POST /api/auth/register  → create user
 *   POST /api/auth/login     → returns { token, user }
 *   GET  /api/auth/me        → returns current user (protected)
 */
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { db } from '../database';
import { env } from '../config/env';
import { ApiError } from '../middleware/errorHandler';
import { AuthUser, Role, signToken } from '../middleware/auth';

/* ------------------------------------------------------------------ */
/*  Validation schemas                                                */
/* ------------------------------------------------------------------ */
const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'detective', 'analyst', 'user']).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Row shape returned by SQLite                                      */
/* ------------------------------------------------------------------ */
interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  created_at: string;
}

function toAuthUser(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

/* ------------------------------------------------------------------ */
/*  POST /api/auth/register                                           */
/* ------------------------------------------------------------------ */
export function register(req: Request, res: Response): void {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid registration payload', parsed.error.flatten());
  }
  const { email, password, name, role } = parsed.data;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
    | { id: number }
    | undefined;
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = bcrypt.hashSync(password, env.BCRYPT_ROUNDS);

  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES (?,?,?,?)`
    )
    .run(email, passwordHash, name, role ?? 'user');

  const userId = Number(info.lastInsertRowid);
  const row = db
    .prepare('SELECT id, email, password_hash, name, role, created_at FROM users WHERE id = ?')
    .get(userId) as UserRow;

  const user = toAuthUser(row);
  const token = signToken(user);

  res.status(201).json({ token, user });
}

/* ------------------------------------------------------------------ */
/*  POST /api/auth/login                                              */
/* ------------------------------------------------------------------ */
export function login(req: Request, res: Response): void {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid login payload', parsed.error.flatten());
  }
  const { email, password } = parsed.data;

  const row = db
    .prepare('SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = ?')
    .get(email) as UserRow | undefined;

  // Same error for "no such user" and "bad password" → don't leak whether the email exists.
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const user = toAuthUser(row);
  const token = signToken(user);

  res.json({ token, user });
}

/* ------------------------------------------------------------------ */
/*  GET /api/auth/me                                                  */
/* ------------------------------------------------------------------ */
export function me(req: Request, res: Response): void {
  if (!req.user) throw new ApiError(401, 'Not authenticated');

  const row = db
    .prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?')
    .get(req.user.id) as
    | { id: number; email: string; name: string; role: Role; created_at: string }
    | undefined;

  if (!row) throw new ApiError(404, 'User no longer exists');

  res.json({ user: row });
}