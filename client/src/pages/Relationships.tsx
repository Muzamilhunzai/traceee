import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- Added
import { Users, UserX, Eye, Fingerprint, Lightbulb, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { apiErrorMessage, relationshipsApi, CaseGraph, RelationshipSelector } from '../api/client';
import { Badge, statusTone } from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';

export default function Relationships() {
  const toast = useToast();
  const navigate = useNavigate(); // <-- Added
  const [cases, setCases] = useState<RelationshipSelector[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [graph, setGraph] = useState<CaseGraph | null>(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(false);

  useEffect(() => {
    relationshipsApi.listCases()
      .then((rows) => {
        setCases(rows);
        if (rows.length > 0) setSelectedCaseId(String(rows[0].id));
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoadingCases(false));
  }, [toast]);

  const loadGraph = useCallback(async (id: number) => {
    setLoadingGraph(true);
    try {
      setGraph(await relationshipsApi.getGraph(id));
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setGraph(null);
    } finally {
      setLoadingGraph(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedCaseId) loadGraph(Number(selectedCaseId));
  }, [selectedCaseId, loadGraph]);

  const selectedMeta = cases.find((c) => c.id === Number(selectedCaseId));

  const clueLinkedEvidence = (clueId: number): string[] => {
    if (!graph) return [];
    return graph.edges
      .filter((e) => e.from === `clue:${clueId}` && e.to.startsWith('evidence:'))
      .map((e) => {
        const evId = Number(e.to.split(':')[1]);
        const ev = graph.evidence.find((x) => x.id === evId);
        return ev ? ev.name : `#${evId}`;
      });
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Relationship Engine</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Visualize connections between a case and its linked entities. Click any item to view full details.
        </p>
      </div>

      <div className="card p-6">
        <label className="label">Select a Case</label>
        {loadingCases ? (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 size={16} className="animate-spin text-primary" /> Loading cases...
          </div>
        ) : cases.length === 0 ? (
          <p className="text-sm font-bold text-slate-500">No cases available.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="input flex-1 sm:max-w-md bg-white font-bold text-slate-700"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} — {c.title}
                </option>
              ))}
            </select>
            {selectedMeta && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={selectedMeta.status} tone={statusTone(selectedMeta.status)} />
                <Badge label={selectedMeta.priority} tone={statusTone(selectedMeta.priority)} />
                <span className="text-xs font-bold text-slate-400 ml-2">
                  {selectedMeta.suspect_count} suspects · {selectedMeta.evidence_count} evidence
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {loadingGraph ? (
        <div className="card grid place-items-center py-20 text-sm font-bold text-slate-500">
          <Loader2 className="mb-3 animate-spin text-primary" size={24} />
          Building graph...
        </div>
      ) : !graph ? (
        <div className="card">
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="No graph loaded"
            description="Pick a case above to visualize its relationships."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card overflow-hidden bg-gradient-to-br from-primary to-indigo-500 p-6 sm:p-8 text-white shadow-float border-none">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Case File</p>
                <p className="font-mono text-sm mt-1">{graph.case.case_number}</p>
                <h2 className="text-2xl font-extrabold leading-tight mt-1">{graph.case.title}</h2>
                <p className="mt-2 text-xs font-medium text-white/80">
                  Investigator: {graph.case.investigator_name || 'Unassigned'} · Opened {graph.case.opened_date}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold">{graph.counts.suspects} Suspects</span>
                <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold">{graph.counts.victims} Victims</span>
                <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold">{graph.counts.witnesses} Witnesses</span>
                <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold">{graph.counts.evidence} Evidence</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <RelationColumn 
              title="Suspects" icon={Users} tone="#8b5cf6" empty="No suspects linked." 
              items={graph.suspects.map((s) => ({ key: s.id, primary: s.name, secondary: s.role || 'Suspect', badge: s.criminal_record !== 'None' ? 'Prior' : undefined }))} 
              onClickItem={(id: number) => navigate('/suspects', { state: { openId: id } })} 
            />
            <RelationColumn 
              title="Victims" icon={UserX} tone="#f43f5e" empty="No victims recorded." 
              items={graph.victims.map((v) => ({ key: v.id, primary: v.name, secondary: v.status || '—' }))} 
              onClickItem={(id: number) => navigate('/victims', { state: { openId: id } })} 
            />
            <RelationColumn 
              title="Witnesses" icon={Eye} tone="#0ea5e9" empty="No witnesses recorded." 
              items={graph.witnesses.map((w) => ({ key: w.id, primary: w.name, secondary: `Reliability ${w.reliability_score}%` }))} 
              onClickItem={(id: number) => navigate('/witnesses', { state: { openId: id } })} 
            />
            <RelationColumn 
              title="Evidence" icon={Fingerprint} tone="#f59e0b" empty="No evidence collected." 
              items={graph.evidence.map((e) => ({ key: e.id, primary: e.name, secondary: `${e.type} · ${e.status}`, badge: `${e.custody_count || 1} custody` }))} 
              onClickItem={(id: number) => navigate('/evidence', { state: { openId: id } })} 
            />
          </div>

          <div className="card">
            <div className="flex items-center gap-3 border-b border-slate-100 p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Lightbulb size={18} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Clues → Evidence Links</h3>
                <p className="text-xs font-medium text-slate-500">M:N mapping via evidence_clues</p>
              </div>
            </div>
            
            {graph.clues.length === 0 ? (
              <EmptyState icon={<Lightbulb size={24} />} title="No clues recorded" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {graph.clues.map((cl) => {
                  const linked = clueLinkedEvidence(cl.id);
                  return (
                    <li key={cl.id} className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between hover:bg-[#F8F9FC]/50 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{cl.name}</span>
                          {cl.significance && <Badge label={cl.significance} tone={statusTone(cl.significance)} />}
                        </div>
                        {cl.description && <p className="mt-1 text-xs font-medium text-slate-500">{cl.description}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {linked.length === 0 ? (
                          <span className="text-[11px] font-bold italic text-slate-400">No linked evidence</span>
                        ) : (
                          linked.map((evName, i) => (
                            <span key={i} className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                              <ArrowRight size={12} /> {evName}
                            </span>
                          ))
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RelationColumn({ title, icon: Icon, tone, empty, items, onClickItem }: any) {
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 p-4 bg-[#F8F9FC]/30">
        <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: `${tone}15`, color: tone }}>
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
          <p className="text-[10px] font-bold text-slate-400">{items.length} linked</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs font-medium text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 flex-1">
          {items.map((it: any) => (
            <li 
              key={it.key} 
              onClick={() => onClickItem(it.key)}
              className="cursor-pointer flex items-start justify-between gap-2 px-4 py-3 hover:bg-slate-50 transition-colors group"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-700 group-hover:text-primary transition-colors">{it.primary}</p>
                <p className="truncate text-[11px] font-medium text-slate-500 mt-0.5">{it.secondary}</p>
              </div>
              {it.badge && (
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {it.badge}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}