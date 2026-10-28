/**
 * =====================================================================
 *  TraceNet — Dashboard Controller
 * =====================================================================
 */
import { Request, Response } from 'express';
import { db } from '../database';

interface SummaryRow {
  total_cases: number;
  active_cases: number;
  solved_cases: number;
  total_evidence: number;
  total_suspects: number;
  total_investigators: number;
}

interface MonthRow {
  month: string;
  total: number;
  solved: number;
}

interface EvidenceTypeRow {
  name: string;
  count: number;
}

export function getDashboardStats(_req: Request, res: Response): void {
  /* --------------------------------------------------------- */
  /* 1. KPI summary                                             */
  /* --------------------------------------------------------- */
  const summary = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM cases)                                AS total_cases,
         (SELECT COUNT(*) FROM cases WHERE status = 'Active')        AS active_cases,
         (SELECT COUNT(*) FROM cases WHERE status = 'Closed')        AS solved_cases,
         (SELECT COUNT(*) FROM evidence)                             AS total_evidence,
         (SELECT COUNT(*) FROM suspects)                             AS total_suspects,
         (SELECT COUNT(*) FROM investigators)                        AS total_investigators`
    )
    .get() as SummaryRow;

  /* --------------------------------------------------------- */
  /* 2. Cases over time (last 12 months, chronological)         */
  /* --------------------------------------------------------- */
  const rawMonths = db
    .prepare(
      `SELECT
         strftime('%Y-%m', opened_date) AS month,
         COUNT(*)                                       AS total,
         SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS solved
       FROM cases
       GROUP BY month
       ORDER BY month ASC`
    )
    .all() as MonthRow[];

  // Fill gaps so the chart always shows 12 consecutive buckets
  const casesOverTime = fillMissingMonths(rawMonths, 12);

  /* --------------------------------------------------------- */
  /* 3. Evidence breakdown by type                              */
  /* --------------------------------------------------------- */
  const evidenceByType = db
    .prepare(
      `SELECT type AS name, COUNT(*) AS count
         FROM evidence
         GROUP BY type
         ORDER BY count DESC, name ASC`
    )
    .all() as EvidenceTypeRow[];

  /* --------------------------------------------------------- */
  /* 4. Recent cases (last 6)                                   */
  /* --------------------------------------------------------- */
  const recentCases = db
    .prepare(
      `SELECT c.id, c.case_number, c.title, c.status, c.priority,
              c.opened_date, i.name AS investigator_name
         FROM cases c
         LEFT JOIN investigators i ON i.id = c.investigator_id
         ORDER BY c.opened_date DESC, c.id DESC
         LIMIT 6`
    )
    .all();

  /* --------------------------------------------------------- */
  /* 5. Recent activity feed (last 6)                           */
  /* --------------------------------------------------------- */
  const recentActivity = db
    .prepare(
      `SELECT ca.id, ca.action, ca.entity_type, ca.details, ca.created_at,
              ca.case_id, c.case_number, u.name AS user_name
         FROM case_activity ca
         LEFT JOIN cases c ON c.id = ca.case_id
         LEFT JOIN users u ON u.id = ca.user_id
         ORDER BY ca.created_at DESC, ca.id DESC
         LIMIT 6`
    )
    .all();

  /* --------------------------------------------------------- */
  /* 6. Status distribution                                     */
  /* --------------------------------------------------------- */
  const statusDistribution = db
    .prepare(
      `SELECT status AS name, COUNT(*) AS count
         FROM cases
         GROUP BY status
         ORDER BY count DESC`
    )
    .all();

  res.json({
    summary,
    cases_over_time: casesOverTime,
    evidence_by_type: evidenceByType,
    recent_cases: recentCases,
    recent_activity: recentActivity,
    status_distribution: statusDistribution,
    generated_at: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ */
/*  Helper — fill missing months with zeros for a clean chart         */
/* ------------------------------------------------------------------ */
function fillMissingMonths(rows: MonthRow[], months: number): MonthRow[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out: MonthRow[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const found = byMonth.get(key);
    out.push({
      month: key,
      total: found?.total ?? 0,
      solved: found?.solved ?? 0,
    });
  }
  return out;
}