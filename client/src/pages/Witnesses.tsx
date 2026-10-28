import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, Plus, Search, Pencil, Trash2, Loader2, Link2, Unlink } from 'lucide-react';
import { apiErrorMessage, casesApi, witnessesApi, Witness, Paginated, Case } from '../api/client';
import { Badge } from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

interface LinkedCase { id: number; case_number: string; title: string; status: string; }

export default function Witnesses() {
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  
  const [data, setData] = useState<Paginated<Witness> | null>(null);
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<Case[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Witness | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Witness | null>(null);
  const [detail, setDetail] = useState<(Witness & { linked_cases: LinkedCase[] }) | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [linkCaseId, setLinkCaseId] = useState('');
  const [linking, setLinking] = useState(false);

  const [form, setForm] = useState<any>({ 
    name: '', phone: '', address: '', statement: '', reliability_score: 50, case_id: '' 
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await witnessesApi.list({ page, limit: 10, search: debounced });
      setData(res);
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, debounced, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced]);
  useEffect(() => { casesApi.list({ limit: 100 }).then(r => setAllCases(r.data)).catch(()=>{}); }, []);

  async function openDetail(w: Witness) {
    try { setDetail(await witnessesApi.get(w.id) as any); setLinkCaseId(''); } 
    catch (err) { toast.error(apiErrorMessage(err)); }
  }

  // Auto-open detail if redirected from Relationship Engine
  useEffect(() => {
    if (location.state?.openId) {
      openDetail({ id: location.state.openId } as Witness);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      const { case_id, ...witnessData } = form;
      const payload = { ...witnessData, reliability_score: form.reliability_score ? Number(form.reliability_score) : null };
      const newWitness = await witnessesApi.create(payload);
      if (case_id) { await casesApi.linkWitness(Number(case_id), newWitness.id); }
      toast.success(`Witness "${form.name}" added`); setCreateOpen(false); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault(); if (!editTarget) return; setSubmitting(true);
    try {
      const { case_id, ...witnessData } = form;
      await witnessesApi.update(editTarget.id, { ...witnessData, reliability_score: form.reliability_score ? Number(form.reliability_score) : null });
      toast.success('Witness updated'); setEditTarget(null); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setSubmitting(true);
    try {
      await witnessesApi.delete(deleteTarget.id); toast.success('Witness deleted'); setDeleteTarget(null); load();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setSubmitting(false); }
  }

  async function refreshDetail() {
    if (!detail) return;
    setDetail(await witnessesApi.get(detail.id) as any);
  }

  async function handleLink() {
    if (!detail || !linkCaseId) return; setLinking(true);
    try {
      await casesApi.linkWitness(Number(linkCaseId), detail.id);
      toast.success('Linked to case'); setLinkCaseId(''); await refreshDetail();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setLinking(false); }
  }

  async function handleUnlink(caseId: number) {
    if (!detail) return; setLinking(true);
    try {
      await casesApi.unlinkWitness(caseId, detail.id);
      toast.success('Unlinked from case'); await refreshDetail();
    } catch (err) { toast.error(apiErrorMessage(err)); } finally { setLinking(false); }
  }

  const openEdit = (w: Witness) => {
    setEditTarget(w);
    setForm({ name: w.name, phone: w.phone || '', address: w.address || '', statement: w.statement || '', reliability_score: w.reliability_score || 50, case_id: '' });
  };

  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const availableCases = detail ? allCases.filter(c => !detail.linked_cases.some(lc => lc.id === c.id)) : allCases;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Witnesses</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage witness statements and link them to cases.</p>
        </div>
        <button onClick={() => { setForm({name:'', phone:'', address:'', statement:'', reliability_score: 50, case_id:''}); setCreateOpen(true); }} className="btn-primary">
          <Plus size={18} /> Add Witness
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search witnesses..." className="input pl-11" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F9FC] text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Reliability</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="mx-auto animate-spin text-primary" size={24} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="p-0"><EmptyState icon={<Eye size={24} />} title="No witnesses found" /></td></tr>
              ) : (
                rows.map((w) => (
                  <tr key={w.id} className="hover:bg-[#F8F9FC]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{w.name}</td>
                    <td className="px-6 py-4 font-medium text-slate-500">{w.phone || '—'}</td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                         <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-primary rounded-full" style={{ width: `${w.reliability_score || 0}%` }} />
                         </div>
                         <span className="text-xs font-bold text-slate-600">{w.reliability_score || 0}%</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openDetail(w)} className="p-2 text-slate-400 hover:text-primary transition-colors" title="View & Link Cases"><Eye size={18} /></button>
                        <button onClick={() => openEdit(w)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Pencil size={18} /></button>
                        <button onClick={() => setDeleteTarget(w)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
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
          <Modal key={idx} open={isOpen} onClose={() => !submitting && (isEdit ? setEditTarget(null) : setCreateOpen(false))} title={isEdit ? "Edit Witness" : "Add Witness"} size="lg"
            footer={<><button onClick={() => isEdit ? setEditTarget(null) : setCreateOpen(false)} className="btn-secondary">Cancel</button><button form={isEdit ? "edit-wit" : "create-wit"} type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button></>}>
            <form id={isEdit ? "edit-wit" : "create-wit"} onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-4">
              <div><label className="label">Name</label><input required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="input" /></div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="label">Phone</label><input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="input" /></div>
                 <div><label className="label">Reliability Score (0-100)</label><input type="number" min="0" max="100" value={form.reliability_score} onChange={e=>setForm({...form, reliability_score: e.target.value})} className="input" /></div>
              </div>
              <div><label className="label">Address</label><input value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="input" /></div>
              <div><label className="label">Statement</label><textarea value={form.statement} onChange={e=>setForm({...form, statement: e.target.value})} className="input" rows={3} placeholder="What did they see?"/></div>
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
              <div><strong className="text-slate-500 block text-xs uppercase mb-1">Phone</strong> {detail.phone || '—'}</div>
              <div>
                <strong className="text-slate-500 block text-xs uppercase mb-1">Reliability</strong> 
                <span className="font-bold text-primary">{detail.reliability_score || 0}%</span>
              </div>
              <div className="col-span-2">
                <strong className="text-slate-500 block text-xs uppercase mb-1">Statement</strong> 
                <p className="italic text-slate-700 bg-white p-3 rounded-lg border border-slate-200 mt-1">"{detail.statement || 'No statement provided'}"</p>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 mb-3 text-sm">Linked Cases</h3>
              {detail.linked_cases.length === 0 ? <p className="text-xs font-medium text-slate-500">No cases linked to this witness yet.</p> : (
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
      
      <Modal open={Boolean(deleteTarget)} onClose={() => !submitting && setDeleteTarget(null)} title="Delete Witness" size="sm"
        footer={<><button onClick={()=>setDeleteTarget(null)} className="btn-secondary">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></>}>
        <p className="text-sm font-medium">Delete <b>{deleteTarget?.name}</b>? All links to cases will be removed.</p>
      </Modal>
    </div>
  );
}