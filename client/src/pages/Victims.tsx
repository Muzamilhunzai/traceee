import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserX, Plus, Search, Pencil, Trash2, Loader2, Eye, Link2, Unlink } from 'lucide-react';
import { apiErrorMessage, casesApi, victimsApi, Victim, Paginated, Case } from '../api/client';
import { Badge, statusTone } from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

interface LinkedCase { id: number; case_number: string; title: string; status: string; }

export default function Victims() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  
  const [data, setData] = useState<Paginated<Victim> | null>(null);
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<Case[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Victim | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Victim | null>(null);
  const [detail, setDetail] = useState<(Victim & { linked_cases: LinkedCase[] }) | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [linkCaseId, setLinkCaseId] = useState('');
  const [linking, setLinking] = useState(false);

  const [form, setForm] = useState<any>({ 
    name: '', age: '', gender: '', status: 'Injured', contact: '', address: '', case_id: '' 
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await victimsApi.list({ page, limit: 10, search: debounced });
      setData(res);
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, debounced, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced]);
  useEffect(() => { casesApi.list({ limit: 100 }).then(r => setAllCases(r.data)).catch(()=>{}); }, []);

  async function openDetail(v: Victim) {
    try { setDetail(await victimsApi.get(v.id) as any); setLinkCaseId(''); } 
    catch (err) { toast.error(apiErrorMessage(err)); }
  }

  // Auto-open detail if redirected from Relationship Engine
  useEffect(() => {
    if (location.state?.openId) {
      openDetail({ id: location.state.openId } as Victim);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      const { case_id, ...victimData } = form;
      const payload = { ...victimData, age: form.age ? Number(form.age) : null };
      const newVictim = await victimsApi.create(payload);
      if (case_id) { await casesApi.linkVictim(Number(case_id), newVictim.id); }
      toast.success(`Victim "${form.name}" added`); setCreateOpen(false); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault(); if (!editTarget) return; setSubmitting(true);
    try {
      const { case_id, ...victimData } = form;
      await victimsApi.update(editTarget.id, { ...victimData, age: form.age ? Number(form.age) : null });
      toast.success('Victim updated'); setEditTarget(null); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setSubmitting(true);
    try {
      await victimsApi.delete(deleteTarget.id); toast.success('Victim deleted'); setDeleteTarget(null); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function refreshDetail() {
    if (!detail) return;
    setDetail(await victimsApi.get(detail.id) as any);
  }

  async function handleLink() {
    if (!detail || !linkCaseId) return; setLinking(true);
    try {
      await casesApi.linkVictim(Number(linkCaseId), detail.id);
      toast.success('Linked to case'); setLinkCaseId(''); await refreshDetail();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setLinking(false); }
  }

  async function handleUnlink(caseId: number) {
    if (!detail) return; setLinking(true);
    try {
      await casesApi.unlinkVictim(caseId, detail.id);
      toast.success('Unlinked from case'); await refreshDetail();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setLinking(false); }
  }

  const openEdit = (v: Victim) => {
    setEditTarget(v);
    setForm({ name: v.name, age: v.age || '', gender: v.gender || '', status: v.status || 'Injured', contact: v.contact || '', address: v.address || '', case_id: '' });
  };

  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const availableCases = detail ? allCases.filter(c => !detail.linked_cases.some(lc => lc.id === c.id)) : allCases;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Victims</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage victims and link them to cases.</p>
        </div>
        <button onClick={() => { setForm({name:'', age:'', gender:'', status:'Injured', contact:'', address:'', case_id:''}); setCreateOpen(true); }} className="btn-primary">
          <Plus size={18} /> Add Victim
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search victims..." className="input pl-11" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F9FC] text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Age</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="mx-auto animate-spin text-primary" size={24} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="p-0"><EmptyState icon={<UserX size={24} />} title="No victims found" /></td></tr>
              ) : (
                rows.map((v) => (
                  <tr key={v.id} className="hover:bg-[#F8F9FC]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{v.name}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{v.age || '—'}</td>
                    <td className="px-6 py-4"><Badge label={v.status || 'Unknown'} tone={statusTone(v.status || '')} /></td>
                    <td className="px-6 py-4 font-medium text-slate-500">{v.contact || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openDetail(v)} className="p-2 text-slate-400 hover:text-primary transition-colors" title="View & Link Cases"><Eye size={18} /></button>
                        <button onClick={() => openEdit(v)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Pencil size={18} /></button>
                        <button onClick={() => setDeleteTarget(v)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
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
          <Modal key={idx} open={isOpen} onClose={() => !submitting && (isEdit ? setEditTarget(null) : setCreateOpen(false))} title={isEdit ? "Edit Victim" : "Add Victim"} size="lg"
            footer={<><button onClick={() => isEdit ? setEditTarget(null) : setCreateOpen(false)} className="btn-secondary">Cancel</button><button form={isEdit ? "edit-vic" : "create-vic"} type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button></>}>
            <form id={isEdit ? "edit-vic" : "create-vic"} onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-4">
              <div><label className="label">Name</label><input required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="input" /></div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="label">Age</label><input type="number" value={form.age} onChange={e=>setForm({...form, age: e.target.value})} className="input" /></div>
                 <div><label className="label">Gender</label><select value={form.gender} onChange={e=>setForm({...form, gender: e.target.value})} className="input"><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="label">Status</label><select value={form.status} onChange={e=>setForm({...form, status: e.target.value})} className="input"><option>Injured</option><option>Deceased</option><option>Recovered</option><option>Missing</option></select></div>
                 <div><label className="label">Contact</label><input value={form.contact} onChange={e=>setForm({...form, contact: e.target.value})} className="input" /></div>
              </div>
              <div><label className="label">Address</label><input value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="input" /></div>
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
              <div><strong className="text-slate-500 block text-xs uppercase mb-1">Status</strong> <Badge label={detail.status || 'Unknown'} tone={statusTone(detail.status || '')} /></div>
              <div className="col-span-2"><strong className="text-slate-500 block text-xs uppercase mb-1">Contact</strong> {detail.contact || '—'}</div>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 mb-3 text-sm">Linked Cases</h3>
              {detail.linked_cases.length === 0 ? <p className="text-xs font-medium text-slate-500">No cases linked to this victim yet.</p> : (
                <div className="space-y-2">
                  {detail.linked_cases.map(lc => (
                    <div key={lc.id} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-sm">
                      <div>
                        <p className="font-bold text-slate-800"><span className="text-primary">{lc.case_number}</span> — {lc.title}</p>
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
      
      <Modal open={Boolean(deleteTarget)} onClose={() => !submitting && setDeleteTarget(null)} title="Delete Victim" size="sm"
        footer={<><button onClick={()=>setDeleteTarget(null)} className="btn-secondary">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></>}>
        <p className="text-sm font-medium">Delete <b>{deleteTarget?.name}</b>? All links to cases will be removed.</p>
      </Modal>
    </div>
  );
}