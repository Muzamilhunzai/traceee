import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onChange: (next: number) => void;
}

export default function Pagination({ page, pages, total, limit, onChange }: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const numbers: (number | '…')[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) numbers.push(i);
  } else {
    numbers.push(1);
    if (page > 3) numbers.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
      numbers.push(i);
    }
    if (page < pages - 2) numbers.push('…');
    numbers.push(pages);
  }

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row dark:border-slate-800">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{start}–{end}</span>{' '}
        of <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={14} /> Prev
        </button>

        {numbers.map((n, idx) =>
          n === '…' ? (
            <span key={`e${idx}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`min-w-[30px] rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                n === page
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              {n}
            </button>
          )
        )}

        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}