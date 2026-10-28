import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderSearch, Users, Fingerprint, Network,
  Settings, HelpCircle, ShieldCheck, X, UserX, Eye // <-- Add Eye here
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: 'Dashboard',           icon: LayoutDashboard, to: '/' },
  { label: 'Cases',               icon: FolderSearch,    to: '/cases' },
  { label: 'Suspects',            icon: Users,           to: '/suspects' },
  { label: 'Victims',             icon: UserX,           to: '/victims' },
  { label: 'Witnesses',           icon: Eye,             to: '/witnesses' }, // <-- Add this
  { label: 'Evidence',            icon: Fingerprint,     to: '/evidence' },
  { label: 'Relationship Engine', icon: Network,         to: '/relationships' },
];

// ... (Rest of the Sidebar code remains exactly the same as your last version)
export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name?.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase() ?? '??';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const content = (
    <aside className="flex h-full w-[260px] flex-col bg-white px-4 py-6 rounded-r-[2rem] lg:rounded-r-none lg:rounded-[2rem] lg:my-4 lg:ml-4 shadow-soft relative z-50">
      <div className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F3E8FF] text-primary">
            <ShieldCheck size={22} className="fill-primary text-primary" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-800">TraceNet</span>
        </div>
        <button onClick={onClose} className="lg:hidden rounded-lg p-1 text-slate-400 hover:bg-slate-100">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={label} to={to} end={to === '/'} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                isActive ? 'bg-[#F3E8FF] text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`
            }
          >
            <Icon size={18} className={({ isActive }: any) => isActive ? 'text-primary' : 'text-slate-400'} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 space-y-4">
        <div className="rounded-3xl bg-[#F8F9FC] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
               {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{user?.name}</p>
              <p className="truncate text-xs font-medium text-slate-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <div className="space-y-1">
            <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:text-rose-500 transition-colors">
              <Settings size={14} /> Sign Out
            </button>
            <button className="flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:text-primary transition-colors">
              <HelpCircle size={14} /> Help & Support
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:flex lg:shrink-0">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
          <div className="relative flex h-full">{content}</div>
        </div>
      )}
    </>
  );
}