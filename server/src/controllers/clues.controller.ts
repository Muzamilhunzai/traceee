/**
 * TraceNet — Clues Controller
 * Endpoints:
 *   GET    /api/clues            → paginated list (filter by case/significance)
 *   GET    /api/clues/:id        → clue + linked evidence
 *   POST   /api/clues            → create
 *   PUT    /api/clues/:id        → update
 *   DELETE /api/clues/:id        → delete
 *   POST   /api/clues/:id/evidence/:evidenceId → link evidence
 *   DELETE /api/clues/:id/evidence/:evidenceId → unlink evidence
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { ApiError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/audit';

const createSchema = z.object({
  case_id:      z.number().int().positive(),
  name:         z.string().trim().min(2).max(200),
  description:  z.string().trim().max(4000).nullable().optional(),
  significance: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
});

const updateSchema = createSchema
  .omit({ case_id: true })
  .partial();

const listQuerySchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(10),
  case_id:      z.coerce.number().int().positive().optional(),
  significance: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  search:       z.string().trim().optional().default(''),
});

interface ClueRow {
  id: number;
  case_id: number;
  name: string;
  description: string | null;
  significance: string | null;
  created_at: string;
}

export function listClues(req: Request, res: Response): void {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Invalid query', parsed.error.flatten());
  const { page, limit, case_id, significance, search } = parsed.data;
  const offset = (page - 1) * limit;

  const wheres: string[] = [];
  const params: unknown[] = [];
  if (case_id)      { wheres.push('case_id = ?');        params.push(case_id); }
  if (significance) { wheres.push('significance = ?');   params.push(significance); }
  if (search)       { wheres.push('(name LIKE ? OR description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM clues ${whereSql}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT cl.*, c.case_number
         FROM clues cl
         LEFT JOIN cases c ON c.id = cl.case_id
         ${whereSql.replace(/case_id|significance|name|description/g, (m) => 'cl.' + m)}
         ORDER BY cl.id DESC
         LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

export function getClue(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const row = db.prepare('SELECT * FROM clues WHERE id = ?').get(id) as
    | ClueRow
    | undefined;
  if (!row) throw new ApiError(404, 'Clue not found');

  const evidence = db
    .prepare(
      `SELECT e.*
         FROM evidence_clues ec
         JOIN evidence e ON e.id = ec.evidence_id
         WHERE ec.clue_id = ?`
    )
    .all(id);

  res.json({ ...row, evidence });
}

export function createClue(req: Request, res: Response): void {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid clue payload', parsed.error.flatten());
  }
  const d = parsed.data;

  const caseExists = db.prepare('SELECT id FROM cases WHERE id = ?').get(d.case_id);
  if (!caseExists) throw new ApiError(404, 'Case not found');

  const info = db
    .prepare(
      `INSERT INTO clues (case_id, name, description, significance) VALUES (?,?,?,?)`
    )
    .run(d.case_id, d.name, d.description ?? null, d.significance ?? 'Medium');

  logActivity({
    req,
    caseId: d.case_id,
    action: 'CREATE',
    entityType: 'clue',
    entityId: Number(info.lastInsertRowid),
    details: `Added clue "${d.name}"`,
  });

  res.status(201).json(db.prepare('SELECT * FROM clues WHERE id = ?').get(Number(info.lastInsertRowid)));
}

export function updateClue(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid clue payload', parsed.error.flatten());
  }

  const current = db.prepare('SELECT * FROM clues WHERE id = ?').get(id) as
    | ClueRow
    | undefined;
  if (!current) throw new ApiError(404, 'Clue not found');

  const fields: string[] = [];
  const params: unknown[] = [];
  for (const key of ['name', 'description', 'significance'] as const) {
    if (key in parsed.data && parsed.data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(parsed.data[key] as unknown);
    }
  }
  if (fields.length) {
    params.push(id);
    db.prepare(`UPDATE clues SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    logActivity({
      req,
      caseId: current.case_id,
      action: 'UPDATE',
      entityType: 'clue',
      entityId: id,
      details: `Updated clue #${id}`,
    });
  }
  res.json(db.prepare('SELECT * FROM clues WHERE id = ?').get(id));
}

export function deleteClue(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const current = db.prepare('SELECT * FROM clues WHERE id = ?').get(id) as
    | ClueRow
    | undefined;
  if (!current) throw new ApiError(404, 'Clue not found');

  db.prepare('DELETE FROM clues WHERE id = ?').run(id);
  logActivity({
    req,
    caseId: current.case_id,
    action: 'DELETE',
    entityType: 'clue',
    entityId: id,
    details: `Deleted clue #${id}`,
  });
  res.json({ deleted: true, id });
}

export function linkEvidence(req: Request, res: Response): void {
  const clueId = Number(req.params.id);
  const evidenceId = Number(req.params.evidenceId);
  if (!Number.isInteger(clueId) || !Number.isInteger(evidenceId)) {
    throw new ApiError(400, 'Invalid ids');
  }

  const clue = db.prepare('SELECT case_id FROM clues WHERE id = ?').get(clueId) as
    | { case_id: number }
    | undefined;
  if (!clue) throw new ApiError(404, 'Clue not found');

  const ev = db.prepare('SELECT case_id FROM evidence WHERE id = ?').get(evidenceId) as
    | { case_id: number }
    | undefined;
  if (!ev) throw new ApiError(404, 'Evidence not found');
  if (ev.case_id !== clue.case_id) {
    throw new ApiError(400, 'Evidence and clue belong to different cases');
  }

  try {
    db.prepare('INSERT INTO evidence_clues (evidence_id, clue_id) VALUES (?,?)').run(
      evidenceId,
      clueId
    );
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ApiError(409, 'Already linked');
    }
    throw err;
  }

  logActivity({
    req,
    caseId: clue.case_id,
    action: 'LINK',
    entityType: 'clue',
    entityId: clueId,
    details: `Linked evidence #${evidenceId} to clue #${clueId}`,
  });

  res.status(201).json({ linked: true });
}

export function unlinkEvidence(req: Request, res: Response): void {
  const clueId = Number(req.params.id);
  const evidenceId = Number(req.params.evidenceId);
  if (!Number.isInteger(clueId) || !Number.isInteger(evidenceId)) {
    throw new ApiError(400, 'Invalid ids');
  }
  const info = db
    .prepare('DELETE FROM evidence_clues WHERE clue_id = ? AND evidence_id = ?')
    .run(clueId, evidenceId);
  if (info.changes === 0) throw new ApiError(404, 'Link not found');
  res.json({ unlinked: true });
}