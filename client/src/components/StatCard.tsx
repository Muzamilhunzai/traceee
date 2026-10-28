import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; // hex, drives icon bg + sparkline
  data?: number[];
  hint?: string;
}

export default function StatCard({ label, value, icon: Icon, color, data = [], hint }: StatCardProps) {
  const points = data.map((v, i) => ({ i, v }));

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value ?? '—'}</p>
        </div>
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon size={18} />
        </div>
      </div>

      <div className="mt-3 h-10">
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                fill={color}
                fillOpacity={0.15}
                strokeWidth={2}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full rounded-md bg-slate-100 dark:bg-slate-800" />
        )}
      </div>

      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}