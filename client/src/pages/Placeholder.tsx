import { Construction } from 'lucide-react';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary-50 text-primary dark:bg-primary/10">
          <Construction size={24} />
        </div>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">This page is being wired up in the next drop.</p>
      </div>
    </div>
  );
}