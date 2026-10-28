/**
 * =====================================================================
 *  TraceNet — Evidence Controller  (ADBMS DEMONSTRATION)
 *  ---------------------------------------------------------------------
 *  The `createEvidence` handler wraps:
 *
 *      1. INSERT INTO evidence
 *      2. INSERT INTO evidence_custody  ("Collected")
 *
 *  inside a SINGLE `db.transaction()`. If step 2 fails (or is forced
 *  to fail by passing `simulate_custody_failure: true` in the body),
 *  better-sqlite3 throws and the WHOLE transaction rolls back —
 *  satisfying ATOMICITY (the "A" in ACID). The evidence row does not
 *  survive; the caller sees an error; the DB is unchanged.
 *
 *  Try it live:
 *    POST /api/evidence  with body:
 *    {
 *      "case_id": 1, "name": "Test Item", "type": "Physical",
 *      "simulate_custody_failure": true
 *    }
 *    → 500 with { rolledBack: true }
 *    → `SELECT COUNT(*) FROM evidence WHERE name='Test Item'` = 0
 *
 *  Endpoints:
 *    GET    /api/evidence            → paginated list (filter by case/type/status)
 *    GET    /api/evidence/:id        → evidence + custody + linked clues
 *    POST   /api/evidence            → transactional create + initial custody
 *    PUT    /api/evidence/:id        → update
 *    DELETE /api/evidence/:id        → delete
 *    POST   /api/evidence/:id/custody→ append custody transfer
 * =====================================================================
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { ApiError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/audit';

const createSchema = z.object({
  case_id:                 z.number().int().positive(),
  name:                    z.string().trim().min(2).max(200),
  type:                    z.string().trim().min(2).max(60),
  description:             z.string().trim().max(4000).nullable().optional(),
  location_found:          z.string().trim().max(400).nullable().optional(),
  collected_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status:                  z
    .enum(['Collected', 'In Lab', 'Analyzed', 'Archived', 'Disposed'])
    .optional(),
  collected_by:            z.number().int().positive().nullable().optional(),
  // ADBMS demo flag — force the custody insert to fail and observe ROLLBACK.
  simulate_custody_failure: z.boolean().optional(),
});

const updateSchema = createSchema
  .omit({ case_id: true, simulate_custody_failure: true })
  .partial();

const listQuerySchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(10),
  search:  z.string().trim().optional().default(''),
  case_id: z.coerce.number().int().positive().optional(),
  type:    z.string().trim().optional(),
  status:  z.string().trim().optional(),
  sort:    z.enum(['name', 'type', 'status', 'created_at']).optional().default('created_at'),
  order:   z.enum(['asc', 'desc']).optional().default('desc'),
});

const custodySchema = z.object({
  custodian_id: z.number().int().positive().nullable().optional(),
  action:       z.enum(['Collected', 'Transferred', 'Analyzed', 'Stored', 'Returned', 'Disposed']),
  notes:        z.string().trim().max(2000).nullable().optional(),
});

interface EvidenceRow {
  id: number;
  case_id: number;
  name: string;
  type: string;
  description: string | null;
  location_found: string | null;
  collected_date: string | null;
  status: string;
  collected_by: number | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Prepared statements (cached once, reused forever)                 */
/* ------------------------------------------------------------------ */
const insertEvidenceStmt = db.prepare(
  `INSERT INTO evidence
     (case_id, name, type, description, location_found, collected_date, status, collected_by)
   VALUES (?,?,?,?,?,?,?,?)`
);

const insertCustodyStmt = db.prepare(
  `INSERT INTO evidence_custody (evidence_id, custodian_id, action, notes)
   VALUES (?,?,?,?)`
);

/* ------------------------------------------------------------------ */
/*  GET /api/evidence                                                 */
/* ------------------------------------------------------------------ */
export function listEvidence(req: Request, res: Response): void {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Invalid query', parsed.error.flatten());
  const { page, limit, search, case_id, type, status, sort, order } = parsed.data;
  const offset = (page - 1) * limit;

  const sortMap: Record<string, string> = {
    name:       'e.name',
    type:       'e.type',
    status:     'e.status',
    created_at: 'e.created_at',
  };
  const orderCol = `${sortMap[sort]} ${order.toUpperCase()}`;

  const wheres: string[] = [];
  const params: unknown[] = [];
  if (search)  { wheres.push('(e.name LIKE ? OR e.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (case_id) { wheres.push('e.case_id = ?'); params.push(case_id); }
  if (type)    { wheres.push('e.type = ?');    params.push(type); }
  if (status)  { wheres.push('e.status = ?');  params.push(status); }
  const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM evidence e ${whereSql}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT e.*, c.case_number, i.name AS collected_by_name
         FROM evidence e
         LEFT JOIN cases c ON c.id = e.case_id
         LEFT JOIN investigators i ON i.id = e.collected_by
         ${whereSql}
         ORDER BY ${orderCol}, e.id DESC
         LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

/* ------------------------------------------------------------------ */
/*  GET /api/evidence/:id                                             */
/* ------------------------------------------------------------------ */
export function getEvidence(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const row = db.prepare('SELECT * FROM evidence WHERE id = ?').get(id) as
    | EvidenceRow
    | undefined;
  if (!row) throw new ApiError(404, 'Evidence not found');

  const custody = db
    .prepare(
      `SELECT ec.*, i.name AS custodian_name
         FROM evidence_custody ec
         LEFT JOIN investigators i ON i.id = ec.custodian_id
         WHERE ec.evidence_id = ?
         ORDER BY ec.transferred_at ASC, ec.id ASC`
    )
    .all(id);

  const clues = db
    .prepare(
      `SELECT c.*
         FROM evidence_clues ec
         JOIN clues c ON c.id = ec.clue_id
         WHERE ec.evidence_id = ?`
    )
    .all(id);

  res.json({ ...row, custody, clues });
}

/* ------------------------------------------------------------------ */
/*  POST /api/evidence  ⭐  ATOMICITY DEMO                             */
/* ------------------------------------------------------------------ */
export function createEvidence(req: Request, res: Response): void {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid evidence payload', parsed.error.flatten());
  }
  const d = parsed.data;

  // Ensure the case exists first (fail fast, before we start a tx)
  const caseExists = db.prepare('SELECT id FROM cases WHERE id = ?').get(d.case_id);
  if (!caseExists) throw new ApiError(404, `Case #${d.case_id} not found`);

  // The ADBMS star of the show: a single transaction guarantees
  // evidence + custody are created together, or not at all.
  const createEvidenceTx = db.transaction(
    (payload: typeof d): number => {
      const evId = Number(
        insertEvidenceStmt.run(
          payload.case_id,
          payload.name,
          payload.type,
          payload.description ?? null,
          payload.location_found ?? null,
          payload.collected_date ?? null,
          payload.status ?? 'Collected',
          payload.collected_by ?? null
        ).lastInsertRowid
      );

      // Deliberate failure injection for the ADBMS demo.
      // Throwing here triggers better-sqlite3's automatic ROLLBACK.
      if (payload.simulate_custody_failure) {
        throw new Error(
          'SIMULATED CUSTODY INSERT FAILURE — demonstrating ATOMICITY rollback'
        );
      }

      // Initial chain-of-custody record — MUST succeed for evidence to persist.
      insertCustodyStmt.run(
        evId,
        payload.collected_by ?? null,
        'Collected',
        'Initial custody record created on evidence intake.'
      );

      return evId;
    }
  );

  let evidenceId: number;
  try {
    evidenceId = createEvidenceTx(d);
  } catch (err) {
    // Confirm rollback actually happened.
    const orphan = db
      .prepare('SELECT COUNT(*) AS c FROM evidence WHERE case_id = ? AND name = ?')
      .get(d.case_id, d.name) as { c: number };

    // eslint-disable-next-line no-console
    console.error(
      `[evidence] TRANSACTION ROLLED BACK — orphan evidence count = ${orphan.c}`
    );

    res.status(500).json({
      error: (err as Error).message,
      rolledBack: orphan.c === 0,
      note:
        orphan.c === 0
          ? 'Transaction rolled back atomically. No evidence row was created.'
          : 'WARNING: orphan evidence detected — rollback did not complete.',
    });
    return;
  }

  logActivity({
    req,
    caseId: d.case_id,
    action: 'CREATE',
    entityType: 'evidence',
    entityId: evidenceId,
    details: `Added evidence "${d.name}" (${d.type})`,
  });

  const row = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId);
  res.status(201).json(row);
}

/* ------------------------------------------------------------------ */
/*  PUT /api/evidence/:id                                             */
/* ------------------------------------------------------------------ */
export function updateEvidence(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid evidence payload', parsed.error.flatten());
  }

  const current = db.prepare('SELECT * FROM evidence WHERE id = ?').get(id) as
    | EvidenceRow
    | undefined;
  if (!current) throw new ApiError(404, 'Evidence not found');

  const fields: string[] = [];
  const params: unknown[] = [];
  for (const key of [
    'name',
    'type',
    'description',
    'location_found',
    'collected_date',
    'status',
    'collected_by',
  ] as const) {
    if (key in parsed.data && parsed.data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(parsed.data[key] as unknown);
    }
  }

  if (fields.length) {
    params.push(id);
    db.prepare(`UPDATE evidence SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    logActivity({
      req,
      caseId: current.case_id,
      action: 'UPDATE',
      entityType: 'evidence',
      entityId: id,
      details: `Updated evidence #${id}`,
    });
  }
  res.json(db.prepare('SELECT * FROM evidence WHERE id = ?').get(id));
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/evidence/:id                                          */
/* ------------------------------------------------------------------ */
export function deleteEvidence(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const current = db.prepare('SELECT * FROM evidence WHERE id = ?').get(id) as
    | EvidenceRow
    | undefined;
  if (!current) throw new ApiError(404, 'Evidence not found');

  db.prepare('DELETE FROM evidence WHERE id = ?').run(id);

  logActivity({
    req,
    caseId: current.case_id,
    action: 'DELETE',
    entityType: 'evidence',
    entityId: id,
    details: `Deleted evidence #${id} ("${current.name}")`,
  });

  res.json({ deleted: true, id });
}

/* ------------------------------------------------------------------ */
/*  POST /api/evidence/:id/custody                                    */
/* ------------------------------------------------------------------ */
export function addCustody(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const parsed = custodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid custody payload', parsed.error.flatten());
  }

  const current = db.prepare('SELECT * FROM evidence WHERE id = ?').get(id) as
    | EvidenceRow
    | undefined;
  if (!current) throw new ApiError(404, 'Evidence not found');

  const info = insertCustodyStmt.run(
    id,
    parsed.data.custodian_id ?? null,
    parsed.data.action,
    parsed.data.notes ?? null
  );

  logActivity({
    req,
    caseId: current.case_id,
    action: 'UPDATE',
    entityType: 'evidence',
    entityId: id,
    details: `Custody event "${parsed.data.action}" added to evidence #${id}`,
  });

  res.status(201).json(
    db.prepare('SELECT * FROM evidence_custody WHERE id = ?').get(Number(info.lastInsertRowid))
  );
}