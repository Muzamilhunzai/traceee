/**
 * =====================================================================
 *  TraceNet — API Client
 *  ---------------------------------------------------------------------
 *  - axios instance with `/api` baseURL (Vite proxies to :5000)
 *  - request interceptor: attaches Bearer token
 *  - response interceptor: clears auth + redirects on 401
 *  - typed wrappers for every endpoint the backend exposes
 * =====================================================================
 */
import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'tracenet_token';
export const USER_KEY = 'tracenet_user';

export const http = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: string; details?: unknown }>) => {
    if (err.response?.status === 401) {
      // Token invalid or expired — clear local session and bounce to login
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || err.message || 'Request failed';
  }
  return (err as Error)?.message ?? 'Unknown error';
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export type Role = 'admin' | 'detective' | 'analyst' | 'user';
export type CaseStatus = 'Active' | 'Pending' | 'Closed' | 'Cold';
export type CasePriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type EvidenceStatus =
  | 'Collected'
  | 'In Lab'
  | 'Analyzed'
  | 'Archived'
  | 'Disposed';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  created_at?: string;
}

export interface Case {
  id: number;
  case_number: string;
  title: string;
  description: string | null;
  status: CaseStatus;
  priority: CasePriority;
  opened_date: string;
  closed_date: string | null;
  investigator_id: number | null;
  investigator_name: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Suspect {
  id: number;
  name: string;
  age: number | null;
  gender: string | null;
  criminal_record: string | null;
  address: string | null;
  phone: string | null;
  created_at: string;
}

export interface Victim {
  id: number;
  name: string;
  age: number | null;
  gender: string | null;
  status: string | null;
  contact: string | null;
  address: string | null;
  created_at: string;
}

export interface Witness {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  statement: string | null;
  reliability_score: number | null;
  created_at: string;
}

export interface Evidence {
  id: number;
  case_id: number;
  name: string;
  type: string;
  description: string | null;
  location_found: string | null;
  collected_date: string | null;
  status: EvidenceStatus;
  collected_by: number | null;
  collected_by_name?: string | null;
  case_number?: string;
  custody_count?: number;
  created_at: string;
}

export interface EvidenceCustody {
  id: number;
  evidence_id: number;
  custodian_id: number | null;
  custodian_name?: string | null;
  action: string;
  notes: string | null;
  transferred_at: string;
}

export interface Clue {
  id: number;
  case_id: number;
  name: string;
  description: string | null;
  significance: 'Low' | 'Medium' | 'High' | 'Critical' | null;
  created_at: string;
  linked_evidence_ids?: string | null;
  case_number?: string;
}

export interface CaseNote {
  id: number;
  case_id: number;
  author_id: number | null;
  author_name?: string | null;
  note: string;
  created_at: string;
}

export interface ActivityRow {
  id: number;
  case_id: number;
  user_id: number | null;
  user_name?: string | null;
  case_number?: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

export interface CaseDetail extends Case {
  suspects: Suspect[];
  victims: Victim[];
  witnesses: Witness[];
  evidence: Evidence[];
  clues: Clue[];
  notes: CaseNote[];
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Auth                                                              */
/* ------------------------------------------------------------------ */
export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (payload: { email: string; password: string }) =>
    http.post<AuthResponse>('/auth/login', payload).then((r) => r.data),
  register: (payload: { email: string; password: string; name: string; role?: Role }) =>
    http.post<AuthResponse>('/auth/register', payload).then((r) => r.data),
  me: () => http.get<{ user: User }>('/auth/me').then((r) => r.data.user),
};

/* ------------------------------------------------------------------ */
/*  Dashboard                                                         */
/* ------------------------------------------------------------------ */
export interface DashboardStats {
  summary: {
    total_cases: number;
    active_cases: number;
    solved_cases: number;
    total_evidence: number;
    total_suspects: number;
    total_investigators: number;
  };
  cases_over_time: { month: string; total: number; solved: number }[];
  evidence_by_type: { name: string; count: number }[];
  recent_cases: Array<{
    id: number;
    case_number: string;
    title: string;
    status: CaseStatus;
    priority: CasePriority;
    opened_date: string;
    investigator_name: string | null;
  }>;
  recent_activity: ActivityRow[];
  status_distribution: { name: string; count: number }[];
  generated_at: string;
}

export const dashboardApi = {
  get: () => http.get<DashboardStats>('/dashboard-stats').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Cases                                                             */
/* ------------------------------------------------------------------ */
export interface CaseListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: CaseStatus | '';
  priority?: CasePriority | '';
  sort?: 'case_number' | 'title' | 'status' | 'priority' | 'opened_date' | 'updated_at';
  order?: 'asc' | 'desc';
}

export interface CaseCreateInput {
  case_number: string;
  title: string;
  description?: string | null;
  status?: CaseStatus;
  priority?: CasePriority;
  opened_date: string;
  closed_date?: string | null;
  investigator_id?: number | null;
}

export const casesApi = {
  list: (q: CaseListQuery = {}) =>
    http.get<Paginated<Case>>('/cases', { params: q }).then((r) => r.data),
  get: (id: number) => http.get<CaseDetail>(`/cases/${id}`).then((r) => r.data),
  create: (payload: CaseCreateInput) =>
    http.post<Case>('/cases', payload).then((r) => r.data),
  update: (id: number, payload: Partial<CaseCreateInput>) =>
    http.put<Case>(`/cases/${id}`, payload).then((r) => r.data),
  delete: (id: number) => http.delete(`/cases/${id}`).then((r) => r.data),
  activity: (id: number) =>
    http.get<ActivityRow[]>(`/cases/${id}/activity`).then((r) => r.data),
  addNote: (id: number, note: string) =>
    http.post<CaseNote>(`/cases/${id}/notes`, { note }).then((r) => r.data),
  linkSuspect: (id: number, suspect_id: number, role?: string) =>
    http.post(`/cases/${id}/suspects`, { suspect_id, role }).then((r) => r.data),
  unlinkSuspect: (id: number, suspectId: number) =>
    http.delete(`/cases/${id}/suspects/${suspectId}`).then((r) => r.data),
  linkVictim: (id: number, victim_id: number) =>
    http.post(`/cases/${id}/victims`, { victim_id }).then((r) => r.data),
  unlinkVictim: (id: number, victimId: number) =>
    http.delete(`/cases/${id}/victims/${victimId}`).then((r) => r.data),
  linkWitness: (id: number, witness_id: number) =>
    http.post(`/cases/${id}/witnesses`, { witness_id }).then((r) => r.data),
  unlinkWitness: (id: number, witnessId: number) =>
    http.delete(`/cases/${id}/witnesses/${witnessId}`).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Suspects / Victims / Witnesses                                    */
/* ------------------------------------------------------------------ */
export interface SimpleListQuery {
  page?: number;
  limit?: number;
  search?: string;
}
export interface Investigator {
  id: number;
  name: string;
  badge_number: string;
  rank: string;
  department: string;
}

export const investigatorsApi = {
  list: () => http.get<Investigator[]>('/investigators').then((r) => r.data),
};

export const suspectsApi = {
  list: (q: SimpleListQuery = {}) =>
    http.get<Paginated<Suspect>>('/suspects', { params: q }).then((r) => r.data),
  get: (id: number) => http.get<Suspect & { linked_cases: unknown[] }>(`/suspects/${id}`).then((r) => r.data),
  create: (payload: Partial<Suspect>) =>
    http.post<Suspect>('/suspects', payload).then((r) => r.data),
  update: (id: number, payload: Partial<Suspect>) =>
    http.put<Suspect>(`/suspects/${id}`, payload).then((r) => r.data),
  delete: (id: number) => http.delete(`/suspects/${id}`).then((r) => r.data),
};

export const victimsApi = {
  list: (q: SimpleListQuery = {}) =>
    http.get<Paginated<Victim>>('/victims', { params: q }).then((r) => r.data),
  // Add this "get" line:
  get: (id: number) =>
    http.get<Victim & { linked_cases: unknown[] }>(`/victims/${id}`).then((r) => r.data),
  create: (payload: Partial<Victim>) =>
    http.post<Victim>('/victims', payload).then((r) => r.data),
  update: (id: number, payload: Partial<Victim>) =>
    http.put<Victim>(`/victims/${id}`, payload).then((r) => r.data),
  delete: (id: number) => http.delete(`/victims/${id}`).then((r) => r.data),
};

export const witnessesApi = {
  list: (q: SimpleListQuery = {}) =>
    http.get<Paginated<Witness>>('/witnesses', { params: q }).then((r) => r.data),
  // Add this "get" line:
  get: (id: number) =>
    http.get<Witness & { linked_cases: unknown[] }>(`/witnesses/${id}`).then((r) => r.data),
  create: (payload: Partial<Witness>) =>
    http.post<Witness>('/witnesses', payload).then((r) => r.data),
  update: (id: number, payload: Partial<Witness>) =>
    http.put<Witness>(`/witnesses/${id}`, payload).then((r) => r.data),
  delete: (id: number) => http.delete(`/witnesses/${id}`).then((r) => r.data),
};
/* ------------------------------------------------------------------ */
/*  Evidence                                                          */
/* ------------------------------------------------------------------ */
export interface EvidenceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  case_id?: number;
  type?: string;
  status?: EvidenceStatus | '';
  sort?: 'name' | 'type' | 'status' | 'created_at';
  order?: 'asc' | 'desc';
}

export interface EvidenceCreateInput {
  case_id: number;
  name: string;
  type: string;
  description?: string | null;
  location_found?: string | null;
  collected_date?: string | null;
  status?: EvidenceStatus;
  collected_by?: number | null;
  simulate_custody_failure?: boolean;
}

export const evidenceApi = {
  list: (q: EvidenceListQuery = {}) =>
    http.get<Paginated<Evidence>>('/evidence', { params: q }).then((r) => r.data),
  get: (id: number) =>
    http
      .get<Evidence & { custody: EvidenceCustody[]; clues: Clue[] }>(`/evidence/${id}`)
      .then((r) => r.data),
  create: (payload: EvidenceCreateInput) =>
    http.post<Evidence>('/evidence', payload).then((r) => r.data),
  update: (id: number, payload: Partial<EvidenceCreateInput>) =>
    http.put<Evidence>(`/evidence/${id}`, payload).then((r) => r.data),
  delete: (id: number) => http.delete(`/evidence/${id}`).then((r) => r.data),
  addCustody: (
    id: number,
    payload: { custodian_id?: number | null; action: string; notes?: string | null }
  ) => http.post<EvidenceCustody>(`/evidence/${id}/custody`, payload).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Clues                                                             */
/* ------------------------------------------------------------------ */
export const cluesApi = {
  list: (q: { page?: number; limit?: number; case_id?: number; search?: string } = {}) =>
    http.get<Paginated<Clue>>('/clues', { params: q }).then((r) => r.data),
  get: (id: number) => http.get<Clue & { evidence: Evidence[] }>(`/clues/${id}`).then((r) => r.data),
  create: (payload: { case_id: number; name: string; description?: string; significance?: string }) =>
    http.post<Clue>('/clues', payload).then((r) => r.data),
  update: (id: number, payload: Partial<Clue>) =>
    http.put<Clue>(`/clues/${id}`, payload).then((r) => r.data),
  delete: (id: number) => http.delete(`/clues/${id}`).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Relationships                                                     */
/* ------------------------------------------------------------------ */
export interface RelationshipSelector {
  id: number;
  case_number: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  opened_date: string;
  suspect_count: number;
  evidence_count: number;
}

export interface CaseGraph {
  case: Case;
  suspects: (Suspect & { role: string })[];
  victims: Victim[];
  witnesses: Witness[];
  evidence: Evidence[];
  clues: Clue[];
  edges: { from: string; to: string; label: string }[];
  counts: {
    suspects: number;
    victims: number;
    witnesses: number;
    evidence: number;
    clues: number;
  };
}

export const relationshipsApi = {
  listCases: () =>
    http.get<RelationshipSelector[]>('/relationships').then((r) => r.data),
  getGraph: (caseId: number) =>
    http.get<CaseGraph>(`/relationships/${caseId}/graph`).then((r) => r.data),
};