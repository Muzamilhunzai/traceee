const MESSAGES = [
  { initials: 'SV', tone: 'bg-indigo-500', name: 'Azeem Hunzai', msg: 'Uploaded the forensics report for CR-2025-1004.', time: '4m' },
  { initials: 'MR', tone: 'bg-emerald-500', name: 'Ali hussain', msg: 'Can you review the CCTV timestamps?', time: '22m' },
  { initials: 'EC', tone: 'bg-amber-500', name: 'Akram ali', msg: 'Suspect interview scheduled for 3 PM.', time: '1h' },
  { initials: 'DO', tone: 'bg-rose-500', name: 'IG Islambad', msg: 'Witness statement needs your signature.', time: '2h' },
];

export default function MessageDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold">Messages</h3>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/10">
          {MESSAGES.length}
        </span>
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {MESSAGES.map((m, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${m.tone}`}>
              {m.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{m.name}</p>
              <p className="truncate text-xs text-slate-500">{m.msg}</p>
            </div>
            <span className="text-[11px] text-slate-400">{m.time}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <button
          onClick={onClose}
          className="w-full rounded-lg py-2 text-center text-sm font-medium text-primary hover:bg-primary-50 dark:hover:bg-primary/10"
        >
          View all messages
        </button>
      </div>
    </div>
  );
}