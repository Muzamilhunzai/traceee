import { Request, Response } from 'express';
import { db } from '../database';

export function listInvestigators(req: Request, res: Response): void {
  const rows = db.prepare(`
    SELECT id, name, badge_number, rank, department 
    FROM investigators 
    ORDER BY name ASC
  `).all();
  
  res.json(rows);
}