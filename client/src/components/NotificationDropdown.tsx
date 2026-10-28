import { FolderPlus, UserCheck, FileWarning, ShieldAlert, type LucideIcon } from 'lucide-react';

interface Notif {
  icon: LucideIcon;
  tone: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

const ITEMS: Notif[] = [
  {
    icon: FolderPlus,
    tone: 'bg-primary/10 text-primary',
    title: 'New case file created',
    desc: 'CR-2025-1012 assigned to you',
    time: '2 min ago',
    unread: true,
  },
  {
    icon: UserCheck,
    tone: 'bg-emerald-500/10 text-emerald-600',
    title: 'Suspect record updated',
    desc: 'Victor Hale linked to 2 cases',
    time: '18 min ago',
    unread: true,
  },
  {
    icon: FileWarning,
    tone: 'bg-amber-500/10 text-amber-600',
    title: 'Evidence pending review',
    desc: '3 forensic reports awaiting sign-off',
    time: '1 hr ago',
    unread: false,
  },
  {
    icon: ShieldAlert,
    tone: 'bg-rose-500/10 text-rose-600',
    title: 'High-risk case flagged',
    desc: 'The Lockbox Murders escalated',
    time: '3 hr ago',
    unread: false,
  },
];

export default function NotificationDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary dark:bg-primary/10">
          2 new
        </span>
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {ITEMS.map((n, i) => (
          <li
            key={i}
            className="flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${n.tone}`}>
              <n.icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{n.title}</p>
              <p className="truncate text-xs text-slate-500">{n.desc}</p>
              <p className="mt-1 text-[11px] text-slate-400">{n.time}</p>
            </div>
            {n.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <button
          onClick={onClose}
          className="w-full rounded-lg py-2 text-center text-sm font-medium text-primary hover:bg-primary-50 dark:hover:bg-primary/10"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}