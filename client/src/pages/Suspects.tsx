import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Pencil, Trash2, Loader2, Eye, Link2, Unlink } from 'lucide-react';
import { apiErrorMessage, casesApi, suspectsApi, Suspect, Paginated, Case } from '../api/client';
import { Badge } from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

interface LinkedCase { id: number; case_number: string; title: string; status: string; role: string | null; }

export default function Suspects() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  
  const [data, setData] = useState<Paginated<Suspect> | null>(null);
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<Case[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Suspect | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Suspect | null>(null);
  const [detail, setDetail] = useState<(Suspect & { linked_cases: LinkedCase[] }) | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [linkCaseId, setLinkCaseId] = useState('');
  const [linking, setLinking] = useState(false);

  const [form, setForm] = useState<any>({ 
    name: '', age: '', gender: '', criminal_record: '', address: '', phone: '', case_id: '' 
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await suspectsApi.list({ page, limit: 10, search: debounced });
      setData(res);
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, debounced, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced]);
  useEffect(() => { casesApi.list({ limit: 100 }).then(r => setAllCases(r.data)).catch(()=>{}); }, []);

  async function openDetail(s: Suspect) {
    try { setDetail(await suspectsApi.get(s.id) as any); setLinkCaseId(''); } 
    catch (err) { toast.error(apiErrorMessage(err)); }
  }

  // Auto-open detail if redirected from Relationship Engine
  useEffect(() => {
    if (location.state?.openId) {
      openDetail({ id: location.state.openId } as Suspect);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      const { case_id, ...suspectData } = form;
      const payload = { ...suspectData, age: form.age ? Number(form.age) : null };
      const newSuspect = await suspectsApi.create(payload);
      if (case_id) { await casesApi.linkSuspect(Number(case_id), newSuspect.id, 'Suspect'); }
      toast.success(`Suspect "${form.name}" added`); setCreateOpen(false); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault(); if (!editTarget) return; setSubmitting(true);
    try {
      const { case_id, ...suspectData } = form;
      await suspectsApi.update(editTarget.id, { ...suspectData, age: form.age ? Number(form.age) : null });
      toast.success('Suspect updated'); setEditTarget(null); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setSubmitting(true);
    try {
      await suspectsApi.delete(deleteTarget.id); toast.success('Suspect deleted'); setDeleteTarget(null); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function refreshDetail() {
    if (!detail) return;
    setDetail(await suspectsApi.get(detail.id) as any);
  }

  async function handleLink() {
    if (!detail || !linkCaseId) return; setLinking(true);
    try {
      await casesApi.linkSuspect(Number(linkCaseId), detail.id, 'Suspect');
      toast.success('Linked to case'); setLinkCaseId(''); await refreshDetail();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setLinking(false); }
  }

  async function handleUnlink(caseId: number) {
    if (!detail) return; setLinking(true);
    try {
      await casesApi.unlinkSuspect(caseId, detail.id);
      toast.success('Unlinked from case'); await refreshDetail();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setLinking(false); }
  }

  const openEdit = (s: Suspect) => {
    setEditTarget(s);
    setForm({ name: s.name, age: s.age || '', gender: s.gender || '', criminal_record: s.criminal_record || '', address: s.address || '', phone: s.phone || '', case_id: '' });
  };

  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const availableCases = detail ? allCases.filter(c => !detail.linked_cases.some(lc => lc.id === c.id)) : allCases;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Suspects</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage persons of interest and their cases.</p>
        </div>
        <button onClick={() => { setForm({name:'', age:'', gender:'', criminal_record:'', address:'', phone:'', case_id:''}); setCreateOpen(true); }} className="btn-primary">
          <Plus size={18} /> Add Suspect
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suspects..." className="input pl-11" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F9FC] text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Age</th>
                <th className="px-6 py-4">Criminal Record</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="mx-auto animate-spin text-primary" size={24} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="p-0"><EmptyState icon={<Users size={24} />} title="No suspects found" /></td></tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8F9FC]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{s.name}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{s.age || '—'}</td>
                    <td className="px-6 py-4 font-medium">{s.criminal_record === 'None' ? <Badge label="None" tone="green" /> : s.criminal_record || '—'}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{s.phone || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openDetail(s)} className="p-2 text-slate-400 hover:text-primary transition-colors" title="View & Link Cases"><Eye size={18} /></button>
                        <button onClick={() => openEdit(s)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Pencil size={18} /></button>
                        <button onClick={() => setDeleteTarget(s)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
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

      {[createOpen, Boolean(editTarget)].map((isOpen, idx) => {
        const isEdit = idx === 1;
        return (
          <Modal key={idx} open={isOpen} onClose={() => !submitting && (isEdit ? setEditTarget(null) : setCreateOpen(false))} title={isEdit ? "Edit Suspect" : "Add Suspect"} size="lg"
            footer={<><button onClick={() => isEdit ? setEditTarget(null) : setCreateOpen(false)} className="btn-secondary">Cancel</button><button form={isEdit ? "edit-sus" : "create-sus"} type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button></>}>
            <form id={isEdit ? "edit-sus" : "create-sus"} onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-4">
              <div><label className="label">Name</label><input required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="input" /></div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="label">Age</label><input type="number" value={form.age} onChange={e=>setForm({...form, age: e.target.value})} className="input" /></div>
                 <div><label className="label">Gender</label><select value={form.gender} onChange={e=>setForm({...form, gender: e.target.value})} className="input"><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></div>
              </div>
              <div><label className="label">Phone</label><input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="input" /></div>
              <div><label className="label">Address</label><input value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="input" /></div>
              <div><label className="label">Criminal Record</label><textarea value={form.criminal_record} onChange={e=>setForm({...form, criminal_record: e.target.value})} className="input" rows={2} placeholder="None, or describe..."/></div>
              {!isEdit && (
                <div className="p-4 bg-[#F8F9FC] rounded-xl border border-slate-100">
                  <label className="label">Link to a Case (Optional)</label>
                  <select value={form.case_id} onChange={e=>setForm({...form, case_id: e.target.value})} className="input bg-white">
                    <option value="">Do not link to any case right now</option>
                    {allCases.map(c => <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>)}
                  </select>
                </div>
              )}
            </form>
          </Modal>
        );
      })}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name || 'Details'} size="lg"
        footer={<button onClick={() => setDetail(null)} className="btn-secondary">Close</button>}>
        {detail && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm bg-[#F8F9FC] p-4 rounded-xl">
              <div><strong className="text-slate-500 block text-xs uppercase mb-1">Age</strong> {detail.age || '—'}</div>
              <div><strong className="text-slate-500 block text-xs uppercase mb-1">Gender</strong> {detail.gender || '—'}</div>
              <div className="col-span-2"><strong className="text-slate-500 block text-xs uppercase mb-1">Criminal Record</strong> {detail.criminal_record || '—'}</div>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 mb-3 text-sm">Linked Cases</h3>
              {detail.linked_cases.length === 0 ? <p className="text-xs font-medium text-slate-500">No cases linked to this suspect yet.</p> : (
                <div className="space-y-2">
                  {detail.linked_cases.map(lc => (
                    <div key={lc.id} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-sm">
                      <div>
                        <p className="font-bold text-slate-800"><span className="text-primary">{lc.case_number}</span> — {lc.title}</p>
                        <p className="text-xs text-slate-500">Role: {lc.role || 'Suspect'}</p>
                      </div>
                      <button onClick={() => handleUnlink(lc.id)} disabled={linking} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg" title="Unlink"><Unlink size={16}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-xs uppercase text-slate-500 mb-3">Link to another Case</h4>
              <div className="flex gap-2">
                <select value={linkCaseId} onChange={e=>setLinkCaseId(e.target.value)} className="input flex-1">
                  <option value="">Select a case...</option>
                  {availableCases.map(c=><option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>)}
                </select>
                <button onClick={handleLink} disabled={!linkCaseId || linking} className="btn-primary"><Link2 size={16}/> Link</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      
      <Modal open={Boolean(deleteTarget)} onClose={() => !submitting && setDeleteTarget(null)} title="Delete Suspect" size="sm"
        footer={<><button onClick={()=>setDeleteTarget(null)} className="btn-secondary">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></>}>
        <p className="text-sm font-medium">Delete <b>{deleteTarget?.name}</b>? All links to cases will be removed.</p>
      </Modal>
    </div>
  );
}