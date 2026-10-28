export type BadgeTone = 'green' | 'amber' | 'slate' | 'sky' | 'rose' | 'violet' | 'blue';

const TONES: Record<BadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400',
  sky:   'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400',
  rose:  'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400',
  violet:'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400',
  blue:  'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400',
};

export function Badge({ label, tone = 'slate' }: { label: string; tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'Active':
    case 'Collected':
    case 'Analyzed':
      return 'green';
    case 'Pending':
    case 'In Lab':
      return 'amber';
    case 'Closed':
    case 'Archived':
    case 'Recovered':
      return 'slate';
    case 'Cold':
    case 'Disposed':
    case 'Deceased':
      return 'rose';
    case 'Critical':
      return 'rose';
    case 'High':
      return 'amber';
    case 'Medium':
      return 'blue';
    case 'Low':
      return 'slate';
    default:
      return 'slate';
  }
}