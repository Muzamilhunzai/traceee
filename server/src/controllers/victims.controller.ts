/**
 * TraceNet — Victims Controller
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { ApiError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/audit';

const createSchema = z.object({
  name:    z.string().trim().min(2).max(120),
  age:     z.number().int().min(0).max(120).nullable().optional(),
  gender:  z.string().trim().max(20).nullable().optional(),
  status:  z.enum(['Injured', 'Deceased', 'Recovered', 'Missing']).optional(),
  contact: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(400).nullable().optional(),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  status: z.string().trim().optional(),
});

export function listVictims(req: Request, res: Response): void {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Invalid query', parsed.error.flatten());
  const { page, limit, search, status } = parsed.data;
  const offset = (page - 1) * limit;

  const wheres: string[] = [];
  const params: unknown[] = [];
  if (search) { wheres.push('name LIKE ?'); params.push(`%${search}%`); }
  if (status) { wheres.push('status = ?');  params.push(status); }
  const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM victims ${whereSql}`).get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(`SELECT * FROM victims ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  res.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

export function getVictim(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const row = db.prepare('SELECT * FROM victims WHERE id = ?').get(id);
  if (!row) throw new ApiError(404, 'Victim not found');

  const cases = db
    .prepare(
      `SELECT c.id, c.case_number, c.title, c.status
         FROM case_victims cv
         JOIN cases c ON c.id = cv.case_id
         WHERE cv.victim_id = ?`
    )
    .all(id);

  res.json({ ...(row as object), linked_cases: cases });
}

export function createVictim(req: Request, res: Response): void {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid victim payload', parsed.error.flatten());
  }
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO victims (name, age, gender, status, contact, address)
       VALUES (?,?,?,?,?,?)`
    )
    .run(
      d.name,
      d.age ?? null,
      d.gender ?? null,
      d.status ?? null,
      d.contact ?? null,
      d.address ?? null
    );
  const row = db.prepare('SELECT * FROM victims WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(row);
}

export function updateVictim(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid victim payload', parsed.error.flatten());
  }
  if (!db.prepare('SELECT id FROM victims WHERE id = ?').get(id)) {
    throw new ApiError(404, 'Victim not found');
  }
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const key of ['name', 'age', 'gender', 'status', 'contact', 'address'] as const) {
    if (key in parsed.data && parsed.data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(parsed.data[key] as unknown);
    }
  }
  if (fields.length) {
    params.push(id);
    db.prepare(`UPDATE victims SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json(db.prepare('SELECT * FROM victims WHERE id = ?').get(id));
}

export function deleteVictim(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const linked = db
    .prepare('SELECT case_id FROM case_victims WHERE victim_id = ?')
    .all(id) as { case_id: number }[];

  const info = db.prepare('DELETE FROM victims WHERE id = ?').run(id);
  if (info.changes === 0) throw new ApiError(404, 'Victim not found');

  for (const { case_id } of linked) {
    logActivity({
      req,
      caseId: case_id,
      action: 'DELETE',
      entityType: 'victim',
      entityId: id,
      details: `Deleted victim #${id}`,
    });
  }
  res.json({ deleted: true, id });
}