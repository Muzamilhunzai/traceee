/**
 * TraceNet — Witnesses Controller
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { ApiError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/audit';

const createSchema = z.object({
  name:              z.string().trim().min(2).max(120),
  phone:             z.string().trim().max(40).nullable().optional(),
  address:           z.string().trim().max(400).nullable().optional(),
  statement:         z.string().trim().max(8000).nullable().optional(),
  reliability_score: z.number().int().min(0).max(100).nullable().optional(),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
});

export function listWitnesses(req: Request, res: Response): void {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Invalid query', parsed.error.flatten());
  const { page, limit, search } = parsed.data;
  const offset = (page - 1) * limit;

  const wheres = search ? 'WHERE name LIKE ? OR statement LIKE ?' : '';
  const params = search ? [`%${search}%`, `%${search}%`] : [];

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM witnesses ${wheres}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT * FROM witnesses ${wheres} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

export function getWitness(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const row = db.prepare('SELECT * FROM witnesses WHERE id = ?').get(id);
  if (!row) throw new ApiError(404, 'Witness not found');

  const cases = db
    .prepare(
      `SELECT c.id, c.case_number, c.title, c.status
         FROM case_witnesses cw
         JOIN cases c ON c.id = cw.case_id
         WHERE cw.witness_id = ?`
    )
    .all(id);

  res.json({ ...(row as object), linked_cases: cases });
}

export function createWitness(req: Request, res: Response): void {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid witness payload', parsed.error.flatten());
  }
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO witnesses (name, phone, address, statement, reliability_score)
       VALUES (?,?,?,?,?)`
    )
    .run(
      d.name,
      d.phone ?? null,
      d.address ?? null,
      d.statement ?? null,
      d.reliability_score ?? 50
    );
  res.status(201).json(db.prepare('SELECT * FROM witnesses WHERE id = ?').get(Number(info.lastInsertRowid)));
}

export function updateWitness(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid witness payload', parsed.error.flatten());
  }
  if (!db.prepare('SELECT id FROM witnesses WHERE id = ?').get(id)) {
    throw new ApiError(404, 'Witness not found');
  }
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const key of ['name', 'phone', 'address', 'statement', 'reliability_score'] as const) {
    if (key in parsed.data && parsed.data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(parsed.data[key] as unknown);
    }
  }
  if (fields.length) {
    params.push(id);
    db.prepare(`UPDATE witnesses SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json(db.prepare('SELECT * FROM witnesses WHERE id = ?').get(id));
}

export function deleteWitness(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const linked = db
    .prepare('SELECT case_id FROM case_witnesses WHERE witness_id = ?')
    .all(id) as { case_id: number }[];

  const info = db.prepare('DELETE FROM witnesses WHERE id = ?').run(id);
  if (info.changes === 0) throw new ApiError(404, 'Witness not found');

  for (const { case_id } of linked) {
    logActivity({
      req,
      caseId: case_id,
      action: 'DELETE',
      entityType: 'witness',
      entityId: id,
      details: `Deleted witness #${id}`,
    });
  }
  res.json({ deleted: true, id });
}