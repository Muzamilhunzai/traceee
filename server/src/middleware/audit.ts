/**
 * TraceNet — Audit Logging
 * -------------------------------------------------------------------
 * Every mutation that touches a case gets a row in `case_activity`.
 * Rows are keyed on:
 *   - case_id     (which case this happened to)
 *   - user_id     (who did it — pulled from req.user)
 *   - action      (CREATE / UPDATE / DELETE / VIEW / ...)
 *   - entity_type (case / suspect / victim / witness / evidence / clue)
 *   - entity_id   (the affected row)
 *   - details     (human-readable description)
 *
 * Audit inserts run OUTSIDE the business transaction on purpose:
 *   - if the business tx rolls back → controller calls logActivity only on success
 *   - if the audit itself fails → it must NOT roll back the business work
 * -------------------------------------------------------------------
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '../database';

export interface AuditPayload {
  req: Request;
  caseId: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LINK' | 'UNLINK';
  entityType?: 'case' | 'suspect' | 'victim' | 'witness' | 'evidence' | 'clue' | 'note';
  entityId?: number;
  details?: string;
}

export function logActivity(payload: AuditPayload): void {
  try {
    db.prepare(
      `INSERT INTO case_activity
         (case_id, user_id, action, entity_type, entity_id, details)
       VALUES (?,?,?,?,?,?)`
    ).run(
      payload.caseId,
      payload.req.user?.id ?? null,
      payload.action,
      payload.entityType ?? null,
      payload.entityId ?? null,
      payload.details ?? null
    );
  } catch (err) {
    // Never let an audit failure break the request.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write activity row:', err);
  }
}

/**
 * Route-level middleware factory.
 * Usage:  router.post('/', authenticate, auditCase('CREATE','case'), handler)
 * The handler must set `res.locals.audit` to { caseId, entityId, details }.
 */
export function auditCase(
  action: AuditPayload['action'],
  entityType?: AuditPayload['entityType']
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Run the handler first via the `finish` event so we know it succeeded.
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const meta = res.locals.audit as
          | { caseId?: number; entityId?: number; details?: string }
          | undefined;
        if (meta?.caseId) {
          logActivity({
            req,
            caseId: meta.caseId,
            action,
            entityType,
            entityId: meta.entityId,
            details: meta.details,
          });
        }
      }
    });
    next();
  };
}