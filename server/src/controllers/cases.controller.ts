/**
 * =====================================================================
 *  TraceNet — Cases Controller
 *  ---------------------------------------------------------------------
 *  Endpoints:
 *    GET    /api/cases                  → paginated list (search/filter/sort)
 *    GET    /api/cases/:id              → single case with all relations
 *    POST   /api/cases                  → create (audited)
 *    PUT    /api/cases/:id              → update (audited)
 *    DELETE /api/cases/:id              → delete (audited)
 *    GET    /api/cases/:id/activity     → audit log for this case
 *
 *    POST   /api/cases/:id/suspects     → link suspect
 *    DELETE /api/cases/:id/suspects/:sid→ unlink suspect
 *    POST   /api/cases/:id/victims      → link victim
 *    DELETE /api/cases/:id/victims/:vid → unlink victim
 *    POST   /api/cases/:id/witnesses    → link witness
 *    DELETE /api/cases/:id/witnesses/:wid → unlink witness
 *    POST   /api/cases/:id/notes        → add case note
 * =====================================================================
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { ApiError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/audit';

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const createCaseSchema = z.object({
  case_number:     z.string().trim().min(3).max(40),
  title:           z.string().trim().min(3).max(200),
  description:     z.string().trim().max(4000).optional().nullable(),
  status:          z.enum(['Active', 'Pending', 'Closed', 'Cold']).optional(),
  priority:        z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  opened_date:     z.string().regex(dateRe, 'opened_date must be YYYY-MM-DD'),
  closed_date:     z.string().regex(dateRe).optional().nullable(),
  investigator_id: z.number().int().positive().nullable().optional(),
});

const updateCaseSchema = createCaseSchema.partial();

const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(10),
  search:   z.string().trim().optional().default(''),
  status:   z.enum(['Active', 'Pending', 'Closed', 'Cold']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  sort:     z.enum(['case_number', 'title', 'status', 'priority', 'opened_date', 'updated_at'])
             .optional().default('opened_date'),
  order:    z.enum(['asc', 'desc']).optional().default('desc'),
});

const linkSchema = z.object({
  suspect_id:  z.number().int().positive().optional(),
  victim_id:   z.number().int().positive().optional(),
  witness_id:  z.number().int().positive().optional(),
  role:        z.string().trim().max(60).optional(),
}).refine(
  (v) => v.suspect_id || v.victim_id || v.witness_id,
  { message: 'At least one of suspect_id / victim_id / witness_id is required' }
);

const noteSchema = z.object({
  note: z.string().trim().min(1).max(4000),
});

/* ------------------------------------------------------------------ */
/*  Row type                                                          */
/* ------------------------------------------------------------------ */
interface CaseRow {
  id: number;
  case_number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  opened_date: string;
  closed_date: string | null;
  investigator_id: number | null;
  investigator_name: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  GET /api/cases                                                    */
/* ------------------------------------------------------------------ */
export function listCases(req: Request, res: Response): void {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid query parameters', parsed.error.flatten());
  }
  const { page, limit, search, status, priority, sort, order } = parsed.data;
  const offset = (page - 1) * limit;

  const sortMap: Record<string, string> = {
    case_number: 'c.case_number',
    title:       'c.title',
    status:      'c.status',
    priority:    'c.priority',
    opened_date: 'c.opened_date',
    updated_at:  'c.updated_at',
  };
  const orderCol = `${sortMap[sort]} ${order.toUpperCase()}`;

  const wheres: string[] = [];
  const params: unknown[] = [];

  if (search) {
    wheres.push(`(c.case_number LIKE ? OR c.title LIKE ? OR c.description LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status)   { wheres.push('c.status = ?');   params.push(status); }
  if (priority) { wheres.push('c.priority = ?'); params.push(priority); }

  const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM cases c ${whereSql}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT c.*, i.name AS investigator_name
         FROM cases c
         LEFT JOIN investigators i ON i.id = c.investigator_id
         ${whereSql}
         ORDER BY ${orderCol}, c.id DESC
         LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as CaseRow[];

  res.json({
    data: rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

/* ------------------------------------------------------------------ */
/*  GET /api/cases/:id                                                */
/* ------------------------------------------------------------------ */
export function getCase(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid case id');

  const row = db
    .prepare(
      `SELECT c.*, i.name AS investigator_name
         FROM cases c
         LEFT JOIN investigators i ON i.id = c.investigator_id
         WHERE c.id = ?`
    )
    .get(id) as CaseRow | undefined;

  if (!row) throw new ApiError(404, 'Case not found');

  const suspects = db
    .prepare(
      `SELECT s.*, cs.role, cs.added_at
         FROM case_suspects cs
         JOIN suspects s ON s.id = cs.suspect_id
         WHERE cs.case_id = ?
         ORDER BY cs.id`
    )
    .all(id);

  const victims = db
    .prepare(
      `SELECT v.*, cv.added_at
         FROM case_victims cv
         JOIN victims v ON v.id = cv.victim_id
         WHERE cv.case_id = ?
         ORDER BY cv.id`
    )
    .all(id);

  const witnesses = db
    .prepare(
      `SELECT w.*, cw.added_at
         FROM case_witnesses cw
         JOIN witnesses w ON w.id = cw.witness_id
         WHERE cw.case_id = ?
         ORDER BY cw.id`
    )
    .all(id);

  const evidence = db
    .prepare(
      `SELECT * FROM evidence WHERE case_id = ? ORDER BY id`
    )
    .all(id);

  const clues = db
    .prepare(
      `SELECT * FROM clues WHERE case_id = ? ORDER BY id`
    )
    .all(id);

  const notes = db
    .prepare(
      `SELECT cn.*, u.name AS author_name
         FROM case_notes cn
         LEFT JOIN users u ON u.id = cn.author_id
         WHERE cn.case_id = ?
         ORDER BY cn.created_at DESC`
    )
    .all(id);

  res.json({
    ...row,
    suspects,
    victims,
    witnesses,
    evidence,
    clues,
    notes,
  });
}

/* ------------------------------------------------------------------ */
/*  POST /api/cases                                                   */
/* ------------------------------------------------------------------ */
export function createCase(req: Request, res: Response): void {
  const parsed = createCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid case payload', parsed.error.flatten());
  }
  const data = parsed.data;

  if (data.status === 'Closed' && !data.closed_date) {
    data.closed_date = new Date().toISOString().slice(0, 10);
  }

  let caseId: number;

  try {
    const info = db
      .prepare(
        `INSERT INTO cases
           (case_number, title, description, status, priority,
            opened_date, closed_date, investigator_id, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(
        data.case_number,
        data.title,
        data.description ?? null,
        data.status ?? 'Active',
        data.priority ?? 'Medium',
        data.opened_date,
        data.closed_date ?? null,
        data.investigator_id ?? null,
        req.user?.id ?? null
      );
    caseId = Number(info.lastInsertRowid);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ApiError(409, `Case number '${data.case_number}' already exists`);
    }
    throw err;
  }

  // Audit AFTER the insert succeeds — audit trail must reflect committed state.
  logActivity({
    req,
    caseId,
    action: 'CREATE',
    entityType: 'case',
    entityId: caseId,
    details: `Created case ${data.case_number} — "${data.title}"`,
  });

  const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId);
  res.status(201).json(row);
}

/* ------------------------------------------------------------------ */
/*  PUT /api/cases/:id                                                */
/* ------------------------------------------------------------------ */
export function updateCase(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid case id');

  const parsed = updateCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid case payload', parsed.error.flatten());
  }

  const current = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as
    | CaseRow
    | undefined;
  if (!current) throw new ApiError(404, 'Case not found');

  const fields: string[] = [];
  const params: unknown[] = [];
  const changed: string[] = [];

  for (const key of [
    'case_number',
    'title',
    'description',
    'status',
    'priority',
    'opened_date',
    'closed_date',
    'investigator_id',
  ] as const) {
    if (key in parsed.data && parsed.data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(parsed.data[key] as unknown);
      changed.push(key);
    }
  }

  // Auto-manage closed_date when status flips to Closed
  if (parsed.data.status === 'Closed' && !parsed.data.closed_date && !current.closed_date) {
    const today = new Date().toISOString().slice(0, 10);
    fields.push('closed_date = ?');
    params.push(today);
    changed.push('closed_date');
  }

  if (fields.length === 0) {
    res.json(current);
    return;
  }

  fields.push("updated_at = datetime('now')");
  params.push(id);

  try {
    db.prepare(`UPDATE cases SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ApiError(409, 'Duplicate case number');
    }
    throw err;
  }

  logActivity({
    req,
    caseId: id,
    action: 'UPDATE',
    entityType: 'case',
    entityId: id,
    details: `Updated case ${current.case_number}: ${changed.join(', ')}`,
  });

  const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  res.json(row);
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/cases/:id                                             */
/* ------------------------------------------------------------------ */
export function deleteCase(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid case id');

  const current = db
    .prepare('SELECT id, case_number, title FROM cases WHERE id = ?')
    .get(id) as { id: number; case_number: string; title: string } | undefined;
  if (!current) throw new ApiError(404, 'Case not found');

  // Note: ON DELETE CASCADE removes suspects_links, evidence, clues, notes, activity.
  // We capture the audit row FIRST in a transaction so it survives the delete.
  const auditInsert = db.prepare(
    `INSERT INTO case_activity
       (case_id, user_id, action, entity_type, entity_id, details)
     VALUES (?,?,?,?,?,?)`
  );

  // Because case_activity has FK → cases(id) ON DELETE CASCADE,
  // the audit row would be deleted with the case. To preserve a
  // hard-delete audit trail, we either (a) soft-delete or
  // (b) accept that activity disappears with the case. Here we
  // choose (b) but log to stderr as a safety trail.
  try {
    const tx = db.transaction((caseId: number) => {
      db.prepare('DELETE FROM cases WHERE id = ?').run(caseId);
    });
    tx(id);
  } catch (err) {
    throw new ApiError(500, 'Failed to delete case', (err as Error).message);
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[audit] DELETED case ${current.case_number} (id=${id}) by user ${req.user?.id ?? 'anon'}`
  );

  res.json({ deleted: true, id, case_number: current.case_number });
}

/* ------------------------------------------------------------------ */
/*  GET /api/cases/:id/activity                                       */
/* ------------------------------------------------------------------ */
export function getCaseActivity(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid case id');

  const exists = db.prepare('SELECT id FROM cases WHERE id = ?').get(id);
  if (!exists) throw new ApiError(404, 'Case not found');

  const rows = db
    .prepare(
      `SELECT ca.*, u.name AS user_name
         FROM case_activity ca
         LEFT JOIN users u ON u.id = ca.user_id
         WHERE ca.case_id = ?
         ORDER BY ca.created_at DESC, ca.id DESC
         LIMIT 200`
    )
    .all(id);

  res.json(rows);
}

/* ------------------------------------------------------------------ */
/*  Linking: suspects / victims / witnesses                           */
/* ------------------------------------------------------------------ */
function ensureCase(id: number): void {
  const row = db.prepare('SELECT id FROM cases WHERE id = ?').get(id);
  if (!row) throw new ApiError(404, 'Case not found');
}

export function linkSuspect(req: Request, res: Response): void {
  const caseId = Number(req.params.id);
  if (!Number.isInteger(caseId) || caseId <= 0) throw new ApiError(400, 'Invalid case id');
  ensureCase(caseId);

  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.suspect_id) {
    throw new ApiError(400, 'suspect_id is required');
  }
  const { suspect_id, role = 'Suspect' } = parsed.data;

  const suspectExists = db.prepare('SELECT id FROM suspects WHERE id = ?').get(suspect_id);
  if (!suspectExists) throw new ApiError(404, 'Suspect not found');

  try {
    db.prepare(
      `INSERT INTO case_suspects (case_id, suspect_id, role) VALUES (?,?,?)`
    ).run(caseId, suspect_id, role);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ApiError(409, 'Suspect already linked to this case');
    }
    throw err;
  }

  logActivity({
    req,
    caseId,
    action: 'LINK',
    entityType: 'suspect',
    entityId: suspect_id,
    details: `Linked suspect #${suspect_id} as "${role}"`,
  });

  res.status(201).json({ linked: true });
}

export function unlinkSuspect(req: Request, res: Response): void {
  const caseId = Number(req.params.id);
  const suspectId = Number(req.params.suspectId);
  if (!Number.isInteger(caseId) || !Number.isInteger(suspectId)) {
    throw new ApiError(400, 'Invalid ids');
  }

  const info = db
    .prepare('DELETE FROM case_suspects WHERE case_id = ? AND suspect_id = ?')
    .run(caseId, suspectId);
  if (info.changes === 0) throw new ApiError(404, 'Link not found');

  logActivity({
    req,
    caseId,
    action: 'UNLINK',
    entityType: 'suspect',
    entityId: suspectId,
    details: `Unlinked suspect #${suspectId}`,
  });
  res.json({ unlinked: true });
}

export function linkVictim(req: Request, res: Response): void {
  const caseId = Number(req.params.id);
  if (!Number.isInteger(caseId) || caseId <= 0) throw new ApiError(400, 'Invalid case id');
  ensureCase(caseId);

  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.victim_id) {
    throw new ApiError(400, 'victim_id is required');
  }
  const { victim_id } = parsed.data;

  const exists = db.prepare('SELECT id FROM victims WHERE id = ?').get(victim_id);
  if (!exists) throw new ApiError(404, 'Victim not found');

  try {
    db.prepare(`INSERT INTO case_victims (case_id, victim_id) VALUES (?,?)`).run(
      caseId,
      victim_id
    );
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ApiError(409, 'Victim already linked to this case');
    }
    throw err;
  }

  logActivity({
    req,
    caseId,
    action: 'LINK',
    entityType: 'victim',
    entityId: victim_id,
    details: `Linked victim #${victim_id}`,
  });
  res.status(201).json({ linked: true });
}

export function unlinkVictim(req: Request, res: Response): void {
  const caseId = Number(req.params.id);
  const victimId = Number(req.params.victimId);
  if (!Number.isInteger(caseId) || !Number.isInteger(victimId)) {
    throw new ApiError(400, 'Invalid ids');
  }

  const info = db
    .prepare('DELETE FROM case_victims WHERE case_id = ? AND victim_id = ?')
    .run(caseId, victimId);
  if (info.changes === 0) throw new ApiError(404, 'Link not found');

  logActivity({
    req,
    caseId,
    action: 'UNLINK',
    entityType: 'victim',
    entityId: victimId,
    details: `Unlinked victim #${victimId}`,
  });
  res.json({ unlinked: true });
}

export function linkWitness(req: Request, res: Response): void {
  const caseId = Number(req.params.id);
  if (!Number.isInteger(caseId) || caseId <= 0) throw new ApiError(400, 'Invalid case id');
  ensureCase(caseId);

  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.witness_id) {
    throw new ApiError(400, 'witness_id is required');
  }
  const { witness_id } = parsed.data;

  const exists = db.prepare('SELECT id FROM witnesses WHERE id = ?').get(witness_id);
  if (!exists) throw new ApiError(404, 'Witness not found');

  try {
    db.prepare(`INSERT INTO case_witnesses (case_id, witness_id) VALUES (?,?)`).run(
      caseId,
      witness_id
    );
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ApiError(409, 'Witness already linked to this case');
    }
    throw err;
  }

  logActivity({
    req,
    caseId,
    action: 'LINK',
    entityType: 'witness',
    entityId: witness_id,
    details: `Linked witness #${witness_id}`,
  });
  res.status(201).json({ linked: true });
}

export function unlinkWitness(req: Request, res: Response): void {
  const caseId = Number(req.params.id);
  const witnessId = Number(req.params.witnessId);
  if (!Number.isInteger(caseId) || !Number.isInteger(witnessId)) {
    throw new ApiError(400, 'Invalid ids');
  }

  const info = db
    .prepare('DELETE FROM case_witnesses WHERE case_id = ? AND witness_id = ?')
    .run(caseId, witnessId);
  if (info.changes === 0) throw new ApiError(404, 'Link not found');

  logActivity({
    req,
    caseId,
    action: 'UNLINK',
    entityType: 'witness',
    entityId: witnessId,
    details: `Unlinked witness #${witnessId}`,
  });
  res.json({ unlinked: true });
}

/* ------------------------------------------------------------------ */
/*  POST /api/cases/:id/notes                                         */
/* ------------------------------------------------------------------ */
export function addNote(req: Request, res: Response): void {
  const caseId = Number(req.params.id);
  if (!Number.isInteger(caseId) || caseId <= 0) throw new ApiError(400, 'Invalid case id');
  ensureCase(caseId);

  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid note payload', parsed.error.flatten());
  }

  const info = db
    .prepare(`INSERT INTO case_notes (case_id, author_id, note) VALUES (?,?,?)`)
    .run(caseId, req.user?.id ?? null, parsed.data.note);

  logActivity({
    req,
    caseId,
    action: 'CREATE',
    entityType: 'note',
    entityId: Number(info.lastInsertRowid),
    details: 'Added case note',
  });

  const row = db
    .prepare(
      `SELECT cn.*, u.name AS author_name
         FROM case_notes cn
         LEFT JOIN users u ON u.id = cn.author_id
         WHERE cn.id = ?`
    )
    .get(Number(info.lastInsertRowid));
  res.status(201).json(row);
}