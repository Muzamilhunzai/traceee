import { useEffect, useRef, useState } from 'react';
import { Search, Bell, MessageSquare, Menu } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import MessageDropdown from './MessageDropdown';

export default function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const [openMenu, setOpenMenu] = useState<'notif' | 'msg' | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="flex h-20 items-center justify-between gap-4 px-4 sm:px-8 mt-2">
      <button onClick={onOpenSidebar} className="rounded-xl p-2 text-slate-500 hover:bg-white lg:hidden">
        <Menu size={20} />
      </button>

      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search"
            className="w-full rounded-full border-none bg-[#F3E8FF]/50 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2" ref={wrapRef}>
        <div className="relative">
          <button
            onClick={() => setOpenMenu(o => o === 'notif' ? null : 'notif')}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#F3E8FF]/50 text-primary hover:bg-[#F3E8FF] transition-colors"
          >
            <Bell size={18} />
          </button>
          {openMenu === 'notif' && <NotificationDropdown onClose={() => setOpenMenu(null)} />}
        </div>
        
        <div className="relative">
          <button
            onClick={() => setOpenMenu(o => o === 'msg' ? null : 'msg')}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#F3E8FF]/50 text-primary hover:bg-[#F3E8FF] transition-colors"
          >
            <MessageSquare size={18} />
          </button>
          {openMenu === 'msg' && <MessageDropdown onClose={() => setOpenMenu(null)} />}
        </div>
      </div>
    </header>
  );
}