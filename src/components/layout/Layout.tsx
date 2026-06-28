import React from 'react';
import Sidebar from './Sidebar';
import { logout } from '../../lib/firebase';
import { LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export default function Layout({ children, currentTab, setCurrentTab }: LayoutProps) {
  return (
    <div className="flex size-screen bg-zinc-50 overflow-hidden font-sans">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-800 capitalize tracking-tight">
             {currentTab.replace('campaigns-', '').replace('logs', 'Lịch sử').replace('system', 'Hệ thống').replace('-', ' ')}
          </h2>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-sm">
               <span className="relative flex size-3">
                 <span className="animate-ping absolute inline-flex size-full rounded-full bg-green-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full size-3 bg-green-500"></span>
               </span>
               <span className="text-zinc-600 font-medium">SIP Connection: Active</span>
             </div>
             <button onClick={logout} className="text-zinc-400 hover:text-red-500 transition-colors p-1" title="Đăng xuất">
                 <LogOut size={18} />
             </button>
             <div className="size-8 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center font-bold border border-violet-200">
               A
             </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}
