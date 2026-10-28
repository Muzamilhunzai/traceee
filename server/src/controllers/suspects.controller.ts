/**
 * TraceNet — Suspects Controller
 * Endpoints:
 *   GET    /api/suspects              → paginated list (search/sort)
 *   GET    /api/suspects/:id          → single + linked cases
 *   POST   /api/suspects              → create
 *   PUT    /api/suspects/:id          → update
 *   DELETE /api/suspects/:id          → delete
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { ApiError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/audit';

const createSchema = z.object({
  name:            z.string().trim().min(2).max(120),
  age:             z.number().int().min(0).max(120).nullable().optional(),
  gender:          z.string().trim().max(20).nullable().optional(),
  criminal_record: z.string().trim().max(2000).nullable().optional(),
  address:         z.string().trim().max(400).nullable().optional(),
  phone:           z.string().trim().max(40).nullable().optional(),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  sort:   z.enum(['name', 'age', 'created_at']).optional().default('created_at'),
  order:  z.enum(['asc', 'desc']).optional().default('desc'),
});

interface SuspectRow {
  id: number;
  name: string;
  age: number | null;
  gender: string | null;
  criminal_record: string | null;
  address: string | null;
  phone: string | null;
  created_at: string;
}

export function listSuspects(req: Request, res: Response): void {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Invalid query', parsed.error.flatten());
  const { page, limit, search, sort, order } = parsed.data;
  const offset = (page - 1) * limit;

  const sortMap: Record<string, string> = {
    name:       'name',
    age:        'age',
    created_at: 'created_at',
  };
  const orderCol = `${sortMap[sort]} ${order.toUpperCase()}`;

  const wheres = search
    ? 'WHERE name LIKE ? OR criminal_record LIKE ?'
    : '';
  const whereParams = search ? [`%${search}%`, `%${search}%`] : [];

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM suspects ${wheres}`).get(...whereParams) as {
      c: number;
    }
  ).c;

  const rows = db
    .prepare(
      `SELECT * FROM suspects ${wheres} ORDER BY ${orderCol}, id DESC LIMIT ? OFFSET ?`
    )
    .all(...whereParams, limit, offset);

  res.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

export function getSuspect(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const row = db.prepare('SELECT * FROM suspects WHERE id = ?').get(id) as
    | SuspectRow
    | undefined;
  if (!row) throw new ApiError(404, 'Suspect not found');

  const cases = db
    .prepare(
      `SELECT c.id, c.case_number, c.title, c.status, cs.role
         FROM case_suspects cs
         JOIN cases c ON c.id = cs.case_id
         WHERE cs.suspect_id = ?
         ORDER BY c.opened_date DESC`
    )
    .all(id);

  res.json({ ...row, linked_cases: cases });
}

export function createSuspect(req: Request, res: Response): void {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid suspect payload', parsed.error.flatten());
  }
  const d = parsed.data;

  const info = db
    .prepare(
      `INSERT INTO suspects (name, age, gender, criminal_record, address, phone)
       VALUES (?,?,?,?,?,?)`
    )
    .run(
      d.name,
      d.age ?? null,
      d.gender ?? null,
      d.criminal_record ?? null,
      d.address ?? null,
      d.phone ?? null
    );

  const id = Number(info.lastInsertRowid);
  const row = db.prepare('SELECT * FROM suspects WHERE id = ?').get(id);
  res.status(201).json(row);
}

export function updateSuspect(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid suspect payload', parsed.error.flatten());
  }

  const exists = db.prepare('SELECT id FROM suspects WHERE id = ?').get(id);
  if (!exists) throw new ApiError(404, 'Suspect not found');

  const fields: string[] = [];
  const params: unknown[] = [];
  for (const key of ['name', 'age', 'gender', 'criminal_record', 'address', 'phone'] as const) {
    if (key in parsed.data && parsed.data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(parsed.data[key] as unknown);
    }
  }
  if (fields.length === 0) {
    res.json(db.prepare('SELECT * FROM suspects WHERE id = ?').get(id));
    return;
  }
  params.push(id);
  db.prepare(`UPDATE suspects SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  res.json(db.prepare('SELECT * FROM suspects WHERE id = ?').get(id));
}

export function deleteSuspect(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id');

  // audit-then-delete: log against any case this suspect touched
  const linked = db
    .prepare('SELECT case_id FROM case_suspects WHERE suspect_id = ?')
    .all(id) as { case_id: number }[];

  const info = db.prepare('DELETE FROM suspects WHERE id = ?').run(id);
  if (info.changes === 0) throw new ApiError(404, 'Suspect not found');

  for (const { case_id } of linked) {
    logActivity({
      req,
      caseId: case_id,
      action: 'DELETE',
      entityType: 'suspect',
      entityId: id,
      details: `Deleted suspect #${id}`,
    });
  }

  res.json({ deleted: true, id });
}