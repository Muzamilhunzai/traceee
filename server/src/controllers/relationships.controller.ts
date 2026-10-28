/**
 * =====================================================================
 *  TraceNet — Relationship Engine Controller
 *  ---------------------------------------------------------------------
 *  Powers the Relationship Engine page. Given a case ID, returns
 *  everything connected to it in a single graph-shaped payload:
 *
 *    node: case
 *    suspects  → with roles
 *    victims
 *    witnesses
 *    evidence  → with type + custody count + linked clues
 *    clues     → with which evidence they point to
 *
 *  The frontend renders this as a visual relationship grid.
 * =====================================================================
 */
import { Request, Response } from 'express';
import { db } from '../database';
import { ApiError } from '../middleware/errorHandler';

export function getCaseGraph(req: Request, res: Response): void {
  const caseId = Number(req.params.caseId);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    throw new ApiError(400, 'Invalid case id');
  }

  const caseRow = db
    .prepare(
      `SELECT c.*, i.name AS investigator_name
         FROM cases c
         LEFT JOIN investigators i ON i.id = c.investigator_id
         WHERE c.id = ?`
    )
    .get(caseId) as Record<string, unknown> | undefined;

  if (!caseRow) throw new ApiError(404, 'Case not found');

  const suspects = db
    .prepare(
      `SELECT s.*, cs.role
         FROM case_suspects cs
         JOIN suspects s ON s.id = cs.suspect_id
         WHERE cs.case_id = ?`
    )
    .all(caseId);

  const victims = db
    .prepare(
      `SELECT v.*
         FROM case_victims cv
         JOIN victims v ON v.id = cv.victim_id
         WHERE cv.case_id = ?`
    )
    .all(caseId);

  const witnesses = db
    .prepare(
      `SELECT w.*
         FROM case_witnesses cw
         JOIN witnesses w ON w.id = cw.witness_id
         WHERE cw.case_id = ?`
    )
    .all(caseId);

  const evidence = db
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM evidence_custody ec WHERE ec.evidence_id = e.id) AS custody_count
         FROM evidence e
         WHERE e.case_id = ?`
    )
    .all(caseId) as Array<{ id: number } & Record<string, unknown>>;

  const clues = db
    .prepare(
      `SELECT cl.*,
              (SELECT GROUP_CONCAT(evidence_id)
                 FROM evidence_clues
                WHERE clue_id = cl.id) AS linked_evidence_ids
         FROM clues cl
         WHERE cl.case_id = ?`
    )
    .all(caseId);

  // Build "edges" for the graph renderer.
  const edges: Array<{ from: string; to: string; label: string }> = [];

  for (const s of suspects as Array<{ id: number; name: string; role?: string }>) {
    edges.push({ from: `case:${caseId}`, to: `suspect:${s.id}`, label: s.role ?? 'Suspect' });
  }
  for (const v of victims as Array<{ id: number; name: string }>) {
    edges.push({ from: `case:${caseId}`, to: `victim:${v.id}`, label: 'Victim' });
  }
  for (const w of witnesses as Array<{ id: number; name: string }>) {
    edges.push({ from: `case:${caseId}`, to: `witness:${w.id}`, label: 'Witness' });
  }
  for (const e of evidence) {
    edges.push({ from: `case:${caseId}`, to: `evidence:${e.id}`, label: 'Evidence' });
  }
  for (const cl of clues as Array<{ id: number; linked_evidence_ids?: string | null }>) {
    if (cl.linked_evidence_ids) {
      for (const evId of cl.linked_evidence_ids.split(',')) {
        edges.push({
          from: `clue:${cl.id}`,
          to: `evidence:${evId}`,
          label: 'Points to',
        });
      }
    }
  }

  res.json({
    case: caseRow,
    suspects,
    victims,
    witnesses,
    evidence,
    clues,
    edges,
    counts: {
      suspects: (suspects as unknown[]).length,
      victims: (victims as unknown[]).length,
      witnesses: (witnesses as unknown[]).length,
      evidence: evidence.length,
      clues: (clues as unknown[]).length,
    },
  });
}

/** GET /api/relationships  → list of cases suitable for the dropdown */
export function listCasesForSelector(req: Request, res: Response): void {
  const rows = db
    .prepare(
      `SELECT c.id, c.case_number, c.title, c.status, c.priority, c.opened_date,
              (SELECT COUNT(*) FROM case_suspects cs WHERE cs.case_id = c.id) AS suspect_count,
              (SELECT COUNT(*) FROM evidence e      WHERE e.case_id  = c.id) AS evidence_count
         FROM cases c
         ORDER BY c.opened_date DESC`
    )
    .all();
  res.json(rows);
}