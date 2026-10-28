import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Fingerprint, Plus, Search, Pencil, Trash2, Loader2, Eye, ShieldAlert } from 'lucide-react';
import { apiErrorMessage, casesApi, evidenceApi, Evidence, EvidenceStatus, Paginated, Case, EvidenceCustody, Clue } from '../api/client';
import { Badge, statusTone } from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const TYPES = ['Physical', 'Digital', 'Forensic', 'Biological', 'Documentary'] as const;
const STATUSES: EvidenceStatus[] = ['Collected', 'In Lab', 'Analyzed', 'Archived', 'Disposed'];
const todayIso = () => new Date().toISOString().slice(0, 10);

interface EvidenceDetail extends Evidence {
  custody: EvidenceCustody[];
  clues: Clue[];
}

export default function EvidencePage() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState<EvidenceStatus | ''>('');

  const [data, setData] = useState<Paginated<Evidence> | null>(null);
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<Case[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Evidence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Evidence | null>(null);
  const [detail, setDetail] = useState<EvidenceDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<any>({
    case_id: '', name: '', type: 'Physical', description: '', location_found: '',
    collected_date: todayIso(), status: 'Collected', simulate_custody_failure: false
  });

  const [custodyAction, setCustodyAction] = useState('Transferred');
  const [custodyNotes, setCustodyNotes] = useState('');
  const [addingCustody, setAddingCustody] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await evidenceApi.list({ page, limit: 10, search: debounced, type: filterType || undefined, status: filterStatus || undefined });
      setData(res);
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, debounced, filterType, filterStatus, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced, filterType, filterStatus]);
  useEffect(() => { casesApi.list({ limit: 100 }).then(r => setAllCases(r.data)).catch(()=>{}); }, []);

  async function openDetail(e: Evidence) {
    try { setDetail(await evidenceApi.get(e.id)); setCustodyAction('Transferred'); setCustodyNotes(''); } 
    catch (err) { toast.error(apiErrorMessage(err)); }
  }

  // Auto-open detail if redirected from Relationship Engine
  useEffect(() => {
    if (location.state?.openId) {
      openDetail({ id: location.state.openId } as Evidence);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); 
    if(!form.case_id) return toast.error('Please select a case');
    setSubmitting(true);
    try {
      const payload = { ...form, case_id: Number(form.case_id), simulate_custody_failure: form.simulate_custody_failure || undefined };
      await evidenceApi.create(payload);
      toast.success(`Added evidence "${form.name}"`); 
      setCreateOpen(false); 
      load();
    } catch (err) {
      if (form.simulate_custody_failure && axios.isAxiosError(err) && (err.response?.data as any)?.rolledBack) {
        toast.success(`✅ ADBMS DEMO: Transaction rolled back! No evidence was created.`);
        setCreateOpen(false); 
        load();
      } else { toast.error(apiErrorMessage(err)); }
    } finally { setSubmitting(false); }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault(); 
    if (!editTarget) return; 
    setSubmitting(true);
    try {
      await evidenceApi.update(editTarget.id, { 
        name: form.name, type: form.type, status: form.status, 
        description: form.description || null, location_found: form.location_found || null, collected_date: form.collected_date || null
      });
      toast.success('Updated evidence'); 
      setEditTarget(null); 
      load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return; 
    setSubmitting(true);
    try {
      await evidenceApi.delete(deleteTarget.id); 
      toast.success('Deleted evidence'); 
      setDeleteTarget(null); 
      load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleAddCustody() {
    if (!detail) return; setAddingCustody(true);
    try {
      await evidenceApi.addCustody(detail.id, { action: custodyAction, notes: custodyNotes || null });
      toast.success('Custody event logged'); setCustodyNotes('');
      setDetail(await evidenceApi.get(detail.id));
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setAddingCustody(false); }
  }

  const openEdit = (e: Evidence) => {
    setEditTarget(e);
    setForm({ case_id: String(e.case_id), name: e.name, type: e.type, description: e.description || '', location_found: e.location_found || '', collected_date: e.collected_date || '', status: e.status, simulate_custody_failure: false });
  };

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Evidence Inventory</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage chain of custody and ACID transactions.</p>
        </div>
        <button onClick={() => { setForm({...form, case_id:'', name:'', simulate_custody_failure:false}); setCreateOpen(true); }} className="btn-primary">
          <Plus size={18} /> Add Evidence
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 p-6 border-b border-slate-100 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search evidence..." className="input pl-11" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input w-auto min-w-[130px]">
              <option value="">All types</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="input w-auto min-w-[140px]">
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F9FC] text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Case</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="mx-auto animate-spin text-primary" size={24} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="p-0"><EmptyState icon={<Fingerprint size={24} />} title="No evidence found" /></td></tr>
              ) : (
                rows.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F8F9FC]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{e.name}</td>
                    <td className="px-6 py-4 font-bold text-primary">{e.case_number || `#${e.case_id}`}</td>
                    <td className="px-6 py-4"><Badge label={e.type} tone="violet" /></td>
                    <td className="px-6 py-4"><Badge label={e.status} tone={statusTone(e.status)} /></td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openDetail(e)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Eye size={18} /></button>
                        <button onClick={() => openEdit(e)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Pencil size={18} /></button>
                        <button onClick={() => setDeleteTarget(e)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination && pagination.total > 0 && <div className="p-4 border-t border-slate-100"><Pagination {...pagination} onChange={setPage} /></div>}
      </div>

      <Modal open={createOpen} onClose={() => !submitting && setCreateOpen(false)} title="Add Evidence" size="lg"
        footer={<><button onClick={()=>setCreateOpen(false)} className="btn-secondary" disabled={submitting}>Cancel</button><button form="ev-form" type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Create Evidence'}</button></>}>
        <form id="ev-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div><label className="label">Case</label><select required value={form.case_id} onChange={e=>setForm({...form, case_id: e.target.value})} className="input"><option value="">Select case...</option>{allCases.map(c=><option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>)}</select></div>
             <div><label className="label">Type</label><select value={form.type} onChange={e=>setForm({...form, type: e.target.value})} className="input">{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          </div>
          <div><label className="label">Name</label><input required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="input" placeholder="e.g. Latent Fingerprint" /></div>
          <div><label className="label">Description</label><textarea value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="input" rows={2}/></div>
          <div className="grid grid-cols-2 gap-4">
             <div><label className="label">Location Found</label><input value={form.location_found} onChange={e=>setForm({...form, location_found: e.target.value})} className="input" /></div>
             <div><label className="label">Collected Date</label><input type="date" value={form.collected_date} onChange={e=>setForm({...form, collected_date: e.target.value})} className="input" /></div>
          </div>
          
          <div className={`rounded-2xl border-2 p-4 transition-colors ${form.simulate_custody_failure ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.simulate_custody_failure} onChange={e=>setForm({...form, simulate_custody_failure: e.target.checked})} className="mt-1 h-5 w-5 accent-rose-500 rounded" />
              <div>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><ShieldAlert size={16} className="text-rose-500"/> Simulate Custody Failure</p>
                <p className="text-xs font-medium text-slate-500 mt-1">Forces the transaction to ROLLBACK, proving ACID Atomicity.</p>
              </div>
            </label>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editTarget)} onClose={() => !submitting && setEditTarget(null)} title="Edit Evidence" size="lg"
        footer={<><button onClick={()=>setEditTarget(null)} className="btn-secondary">Cancel</button><button form="ev-edit-form" type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button></>}>
        <form id="ev-edit-form" onSubmit={handleUpdate} className="space-y-4">
          <div><label className="label">Name</label><input required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="input" /></div>
          <div className="grid grid-cols-2 gap-4">
             <div><label className="label">Type</label><select value={form.type} onChange={e=>setForm({...form, type: e.target.value})} className="input">{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
             <div><label className="label">Status</label><select value={form.status} onChange={e=>setForm({...form, status: e.target.value})} className="input">{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="label">Description</label><textarea value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="input" rows={2}/></div>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name || 'Details'} size="lg"
        footer={<button onClick={() => setDetail(null)} className="btn-secondary">Close</button>}>
        {detail && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong className="text-slate-500 block text-xs uppercase mb-1">Status</strong> <Badge label={detail.status} tone={statusTone(detail.status)} /></div>
              <div><strong className="text-slate-500 block text-xs uppercase mb-1">Collected</strong> {detail.collected_date || '—'}</div>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 mb-3 text-sm">Chain of Custody</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {detail.custody.map(c => (
                  <div key={c.id} className="p-3 bg-[#F8F9FC] rounded-xl flex justify-between items-center text-sm">
                    <div>
                      <p className="font-bold text-slate-700"><Badge label={c.action} tone="violet" /> {c.custodian_name ? `by ${c.custodian_name}` : ''}</p>
                      {c.notes && <p className="text-xs text-slate-500 mt-1">{c.notes}</p>}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{c.transferred_at}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-xs uppercase text-slate-500 mb-3">Log New Custody Event</h4>
              <div className="flex gap-2">
                <select value={custodyAction} onChange={e=>setCustodyAction(e.target.value)} className="input w-32">
                  {['Collected', 'Transferred', 'Analyzed', 'Stored', 'Returned', 'Disposed'].map(a=><option key={a}>{a}</option>)}
                </select>
                <input value={custodyNotes} onChange={e=>setCustodyNotes(e.target.value)} placeholder="Notes (optional)" className="input flex-1" />
                <button onClick={handleAddCustody} disabled={addingCustody} className="btn-primary">Log</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      
      <Modal open={Boolean(deleteTarget)} onClose={() => !submitting && setDeleteTarget(null)} title="Delete Evidence" size="sm"
        footer={<><button onClick={()=>setDeleteTarget(null)} className="btn-secondary">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></>}>
        <p className="text-sm font-medium">Delete <b>{deleteTarget?.name}</b>? This will permanently remove its chain of custody.</p>
      </Modal>
    </div>
  );
}