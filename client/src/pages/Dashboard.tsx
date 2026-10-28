import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus, Fingerprint, Network, Users,
  Activity, CheckCircle2, ChevronRight, AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, Tooltip,
  PieChart, Pie, Cell
} from 'recharts';
import { dashboardApi, DashboardStats, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Badge, statusTone } from '../components/StatusBadge';

const COLORS = ['#8b5cf6', '#38bdf8', '#34d399'];

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get()
      .then(setStats)
      .catch(err => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading || !stats) return <div className="p-10 text-center text-slate-500 font-bold animate-pulse">Loading TraceNet...</div>;

  // Map real data to charts
  const chartData = stats.cases_over_time.map(r => ({ ...r, name: r.month }));
  
  // Calculate clearance rate
  const clearanceRate = stats.summary.total_cases === 0 ? 0 : Math.round((stats.summary.solved_cases / stats.summary.total_cases) * 100);
  const pieData = [
    { name: 'Solved', value: stats.summary.solved_cases },
    { name: 'Active', value: stats.summary.active_cases },
    { name: 'Other', value: stats.summary.total_cases - stats.summary.solved_cases - stats.summary.active_cases },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 max-w-[1600px] mx-auto pb-10">
      
      {/* =========================================
          MIDDLE COLUMN (Main Content)
          ========================================= */}
      <div className="xl:col-span-8 flex flex-col gap-6">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Dashboard</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Welcome back, {user?.name?.split(' ')[0]}!</p>
        </div>

        <div className="mt-2">
          <h2 className="text-3xl font-extrabold text-slate-800 flex items-center gap-2">
            Hi {user?.name?.split(' ')[0]} <span className="text-primary text-2xl">♥</span>
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Here is your investigation overview.</p>
        </div>

        {/* Hero Chart (Replaces the Dog Image) */}
        <div className="card relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-white to-[#F3E8FF]/30">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800">Crime Analytics</h3>
              <p className="text-xs font-bold text-slate-400">Total vs Solved Cases</p>
            </div>
            <div className="bg-white/60 p-2 rounded-xl text-xs font-bold text-primary backdrop-blur-sm shadow-sm flex items-center gap-1">
              <Activity size={14} /> Live
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                <Area type="monotone" dataKey="solved" name="Solved" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorSolved)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'New Case', icon: FolderPlus, path: '/cases' },
            { label: 'Evidence', icon: Fingerprint, path: '/evidence' },
            { label: 'Suspects', icon: Users, path: '/suspects' },
            { label: 'Graph', icon: Network, path: '/relationships' },
          ].map((action, i) => (
            <button key={i} onClick={() => navigate(action.path)} className="card flex flex-col items-center justify-center gap-3 py-5 hover:-translate-y-1 hover:shadow-float transition-all duration-300 group">
              <div className="h-10 w-10 rounded-full bg-[#F8F9FC] flex items-center justify-center group-hover:bg-[#F3E8FF] transition-colors">
                <action.icon size={18} className="text-slate-600 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-xs font-bold text-slate-600 group-hover:text-primary transition-colors">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Bottom Split: Recent Cases & Evidence Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          
          {/* Recent Cases */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-800">Recent Cases</h3>
              <button onClick={() => navigate('/cases')} className="text-xs font-bold text-primary hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              {stats.recent_cases.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-[#F8F9FC] flex items-center justify-center text-primary font-bold">
                    <FolderPlus size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{c.title}</p>
                    <p className="text-[11px] font-medium text-slate-500">{c.case_number} · {c.opened_date}</p>
                  </div>
                  <Badge label={c.status} tone={statusTone(c.status)} />
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Status (Mapped from Evidence Breakdown) */}
          <div className="card p-6">
             <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-800">Evidence Overview</h3>
              <button onClick={() => navigate('/evidence')} className="text-xs font-bold text-primary hover:underline">View All</button>
            </div>
            <div className="space-y-4">
               {stats.evidence_by_type.slice(0, 3).map((e, i) => (
                 <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-[#F8F9FC]">
                    <div className="flex items-center gap-3">
                       <div className="h-2 w-2 rounded-full bg-primary" />
                       <p className="text-sm font-bold text-slate-700">{e.name}</p>
                    </div>
                    <span className="text-xs font-extrabold text-primary bg-white px-2.5 py-1 rounded-lg shadow-sm">{e.count} items</span>
                 </div>
               ))}
            </div>
          </div>

        </div>
      </div>

      {/* =========================================
          RIGHT COLUMN (Activity & Tips)
          ========================================= */}
      <div className="xl:col-span-4 flex flex-col gap-6">
        
        {/* Today's Activity (Clearance Rate) */}
        <div className="card p-6 flex flex-col items-center">
          <h3 className="text-base font-extrabold text-slate-800 self-start mb-4">Case Clearance</h3>
          
          <div className="relative w-40 h-40 mb-4">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                   {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                 </Pie>
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-3xl font-extrabold text-slate-800">{clearanceRate}%</span>
               <span className="text-[10px] font-bold text-slate-400">Clearance Rate</span>
             </div>
          </div>

          <div className="flex w-full justify-between px-2 pt-4 border-t border-slate-100">
             <div className="text-center">
               <p className="text-sm font-extrabold text-slate-800">{stats.summary.total_cases}</p>
               <p className="text-[10px] font-bold text-slate-400">Total</p>
             </div>
             <div className="text-center">
               <p className="text-sm font-extrabold text-slate-800">{stats.summary.active_cases}</p>
               <p className="text-[10px] font-bold text-slate-400">Active</p>
             </div>
             <div className="text-center">
               <p className="text-sm font-extrabold text-slate-800">{stats.summary.total_evidence}</p>
               <p className="text-[10px] font-bold text-slate-400">Evidence</p>
             </div>
          </div>
        </div>

        {/* Audit Feed (Replaces Daily Tip) */}
        <div className="card p-6 flex-1 flex flex-col">
          <h3 className="text-base font-extrabold text-slate-800 mb-4">Recent Activity</h3>
          <div className="flex-1 space-y-4 overflow-y-auto">
             {stats.recent_activity.slice(0, 4).map((a, i) => (
               <div key={i} className="flex gap-3">
                 <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-[#F3E8FF] flex items-center justify-center">
                   <CheckCircle2 size={12} className="text-primary" />
                 </div>
                 <div className="min-w-0">
                   <p className="text-xs font-bold text-slate-700 leading-tight line-clamp-2">{a.details}</p>
                   <p className="text-[10px] font-semibold text-slate-400 mt-1">{a.user_name ?? 'System'} · {a.case_number ?? `Case #${a.case_id}`}</p>
                 </div>
               </div>
             ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button onClick={() => navigate('/cases')} className="w-full rounded-full bg-[#F8F9FC] py-3 text-xs font-bold text-primary hover:bg-[#F3E8FF] transition-colors">
               View All Logs
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}