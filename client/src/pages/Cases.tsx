import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FolderSearch, Plus, Search, Pencil, Trash2, Loader2, Eye } from 'lucide-react';
import { apiErrorMessage, casesApi, Case, CaseStatus, CasePriority, Paginated, investigatorsApi, Investigator } from '../api/client';
import { Badge, statusTone } from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const STATUS_OPTIONS: (CaseStatus | '')[] = ['', 'Active', 'Pending', 'Closed', 'Cold'];
const PRIORITY_OPTIONS: (CasePriority | '')[] = ['', 'Low', 'Medium', 'High', 'Critical'];
const todayIso = () => new Date().toISOString().slice(0, 10);

interface FormState {
  case_number: string; title: string; description: string;
  status: CaseStatus; priority: CasePriority; opened_date: string;
  investigator_id: string;
}
const emptyForm = (): FormState => ({ case_number: '', title: '', description: '', status: 'Active', priority: 'Medium', opened_date: todayIso(), investigator_id: '' });

export default function Cases() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [priority, setPriority] = useState<CasePriority | ''>('');
  const [data, setData] = useState<Paginated<Case> | null>(null);
  const [loading, setLoading] = useState(true);

  const [investigators, setInvestigators] = useState<Investigator[]>([]);

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Case | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Case | null>(null);
  const [viewTarget, setViewTarget] = useState<Case | null>(null);
  
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch investigators for the dropdown
    investigatorsApi.list()
      .then(setInvestigators)
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await casesApi.list({ page, limit, search: debouncedSearch, status: status || undefined, priority: priority || undefined });
      setData(res);
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, limit, debouncedSearch, status, priority, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, status, priority]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await casesApi.create({ 
        ...form, 
        case_number: form.case_number.trim(), 
        title: form.title.trim(), 
        description: form.description.trim() || null,
        investigator_id: form.investigator_id ? Number(form.investigator_id) : null
      });
      toast.success(`Created case ${form.case_number}`); setCreateOpen(false); setForm(emptyForm()); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault(); 
    if (!editTarget) return; 
    setSubmitting(true);
    try {
      await casesApi.update(editTarget.id, { 
        title: form.title.trim(), 
        description: form.description.trim() || null,
        status: form.status, 
        priority: form.priority,
        investigator_id: form.investigator_id ? Number(form.investigator_id) : null
      });
      toast.success('Updated case successfully'); 
      setEditTarget(null); 
      load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setSubmitting(true);
    try {
      await casesApi.delete(deleteTarget.id); 
      toast.success('Deleted case'); 
      setDeleteTarget(null); 
      load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  const openEdit = (c: Case) => {
    setEditTarget(c);
    setForm({ 
      case_number: c.case_number, 
      title: c.title, 
      description: c.description || '', 
      status: c.status, 
      priority: c.priority,
      opened_date: c.opened_date,
      investigator_id: c.investigator_id ? String(c.investigator_id) : ''
    });
  };

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Case Records</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Browse and manage all investigations.</p>
        </div>
        <button onClick={() => { setForm(emptyForm()); setCreateOpen(true); }} className="btn-primary">
          <Plus size={18} /> Add Case
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 p-6 border-b border-slate-100 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cases..." className="input pl-11" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={status} onChange={(e) => setStatus(e.target.value as CaseStatus | '')} className="input w-auto min-w-[140px]">
              {STATUS_OPTIONS.map((o) => <option key={o || 'all'} value={o}>{o || 'All statuses'}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as CasePriority | '')} className="input w-auto min-w-[140px]">
              {PRIORITY_OPTIONS.map((o) => <option key={o || 'all'} value={o}>{o || 'All priorities'}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F9FC] text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Case #</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Investigator</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><Loader2 className="mx-auto animate-spin text-primary" size={24} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="p-0"><EmptyState icon={<FolderSearch size={24} />} title="No cases found" /></td></tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8F9FC]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">{c.case_number}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{c.title}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{c.investigator_name || '—'}</td>
                    <td className="px-6 py-4"><Badge label={c.priority} tone={statusTone(c.priority)} /></td>
                    <td className="px-6 py-4"><Badge label={c.status} tone={statusTone(c.status)} /></td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setViewTarget(c)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Eye size={18} /></button>
                        <button onClick={() => openEdit(c)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Pencil size={18} /></button>
                        <button onClick={() => setDeleteTarget(c)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
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

      {/* CREATE MODAL */}
      <Modal open={createOpen} onClose={() => !submitting && setCreateOpen(false)} title="Add New Case"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button form="create-form" type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Create Case'}</button>
          </>
        }>
        <form id="create-form" onSubmit={handleCreate} className="space-y-4">
           <div><label className="label">Case Number</label><input required value={form.case_number} onChange={e=>setForm({...form, case_number: e.target.value})} className="input" placeholder="CR-2025-XXXX"/></div>
           <div><label className="label">Title</label><input required value={form.title} onChange={e=>setForm({...form, title: e.target.value})} className="input" /></div>
           <div><label className="label">Description</label><textarea value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="input" rows={3}/></div>
           
           <div>
             <label className="label">Assigned Investigator</label>
             <select value={form.investigator_id} onChange={e=>setForm({...form, investigator_id: e.target.value})} className="input">
               <option value="">Unassigned</option>
               {investigators.map(i => <option key={i.id} value={i.id}>{i.name} ({i.department})</option>)}
             </select>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div><label className="label">Priority</label><select value={form.priority} onChange={e=>setForm({...form, priority: e.target.value as any})} className="input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
             <div><label className="label">Status</label><select value={form.status} onChange={e=>setForm({...form, status: e.target.value as any})} className="input"><option>Active</option><option>Pending</option><option>Closed</option></select></div>
           </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={Boolean(editTarget)} onClose={() => !submitting && setEditTarget(null)} title={`Edit Case ${editTarget?.case_number}`}
        footer={
          <>
            <button onClick={() => setEditTarget(null)} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button form="edit-form" type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
          </>
        }>
        <form id="edit-form" onSubmit={handleUpdate} className="space-y-4">
           <div><label className="label">Title</label><input required value={form.title} onChange={e=>setForm({...form, title: e.target.value})} className="input" /></div>
           <div><label className="label">Description</label><textarea value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="input" rows={3}/></div>
           
           <div>
             <label className="label">Assigned Investigator</label>
             <select value={form.investigator_id} onChange={e=>setForm({...form, investigator_id: e.target.value})} className="input">
               <option value="">Unassigned</option>
               {investigators.map(i => <option key={i.id} value={i.id}>{i.name} ({i.department})</option>)}
             </select>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div><label className="label">Priority</label><select value={form.priority} onChange={e=>setForm({...form, priority: e.target.value as any})} className="input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
             <div><label className="label">Status</label><select value={form.status} onChange={e=>setForm({...form, status: e.target.value as any})} className="input"><option>Active</option><option>Pending</option><option>Closed</option><option>Cold</option></select></div>
           </div>
        </form>
      </Modal>
      
      {/* DELETE MODAL */}
      <Modal open={Boolean(deleteTarget)} onClose={() => !submitting && setDeleteTarget(null)} title="Delete Case" size="sm"
        footer={<><button onClick={()=>setDeleteTarget(null)} className="btn-secondary">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></>}>
        <p className="text-sm font-medium">Are you sure you want to delete <b>{deleteTarget?.case_number}</b>? All linked records will be removed.</p>
      </Modal>

      {/* VIEW MODAL */}
      <Modal open={Boolean(viewTarget)} onClose={() => setViewTarget(null)} title={viewTarget?.case_number || 'Case Details'} size="md"
        footer={<button onClick={() => setViewTarget(null)} className="btn-secondary">Close</button>}>
        {viewTarget && (
          <div className="space-y-4 text-sm">
            <div><strong className="text-slate-500 block text-xs uppercase">Title</strong> {viewTarget.title}</div>
            <div><strong className="text-slate-500 block text-xs uppercase">Description</strong> {viewTarget.description || '—'}</div>
            <div className="grid grid-cols-2 gap-4">
              <div><strong className="text-slate-500 block text-xs uppercase">Status</strong> <Badge label={viewTarget.status} tone={statusTone(viewTarget.status)} /></div>
              <div><strong className="text-slate-500 block text-xs uppercase">Priority</strong> <Badge label={viewTarget.priority} tone={statusTone(viewTarget.priority)} /></div>
            </div>
            <div><strong className="text-slate-500 block text-xs uppercase">Investigator</strong> {viewTarget.investigator_name || '—'}</div>
            <div><strong className="text-slate-500 block text-xs uppercase">Opened Date</strong> {viewTarget.opened_date}</div>
          </div>
        )}
      </Modal>

    </div>
  );
}