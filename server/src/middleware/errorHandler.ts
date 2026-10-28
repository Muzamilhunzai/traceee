/**
 * TraceNet — Error Handling
 * - ApiError:       the ONLY error type thrown by controllers.
 * - asyncHandler:   wraps async route handlers → forwards rejections to next().
 * - notFound:       catches unknown routes.
 * - errorHandler:   single source of truth for HTTP error responses.
 */
import { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { env } from '../config/env';

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (
  err,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Known application errors
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: err.message,
      details: err.details,
    });
    return;
  }

  // SQLite constraint violations from better-sqlite3
  const sqlite = err as { code?: string; message?: string };
  if (sqlite.code === 'SQLITE_CONSTRAINT_UNIQUE' || sqlite.code === 'SQLITE_CONSTRAINT') {
    res.status(409).json({
      error: 'Database constraint violated',
      details: sqlite.message,
    });
    return;
  }

  // JWT / auth errors
  if (sqlite.message?.includes('jwt')) {
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }

  // Fallback
  // eslint-disable-next-line no-console
  console.error('[errorHandler] unhandled:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(env.NODE_ENV !== 'production' && sqlite.message
      ? { details: sqlite.message }
      : {}),
  });
};