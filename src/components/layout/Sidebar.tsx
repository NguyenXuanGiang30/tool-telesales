import { useState } from 'react';
import { LayoutDashboard, Megaphone, Users, PhoneCall, Settings, Mic, HardDrive, ChevronDown, PhoneForwarded, Headphones, Send } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export default function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['campaigns']);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan (Dashboard)', icon: LayoutDashboard },
    { 
      id: 'campaigns', 
      label: 'Chiến dịch', 
      icon: Megaphone,
      subItems: [
        { id: 'campaigns-callbot', label: 'Callbot', icon: PhoneForwarded },
        { id: 'campaigns-telesale', label: 'Telesale', icon: Headphones },
        { id: 'campaigns-messages', label: 'Tin nhắn', icon: Send },
      ]
    },
    { id: 'contacts', label: 'Khách hàng (CRM)', icon: Users },
    { id: 'logs', label: 'Lịch sử cuộc gọi', icon: PhoneCall },
    { id: 'system', label: 'Hệ thống (Hardware/GSM)', icon: HardDrive },
  ];

  return (
    <div className="w-64 h-full bg-white text-zinc-600 flex flex-col shrink-0 border-r border-zinc-200">
      <div className="h-16 flex items-center px-6 border-b border-zinc-100">
        <h1 className="text-zinc-800 font-semibold text-lg flex items-center gap-2.5">
          <div className="bg-violet-600 text-white p-1.5 rounded-lg shadow-sm">
            <PhoneCall size={16} />
          </div>
          <span className="tracking-tight">AutoCall</span>
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const hasSub = !!item.subItems;
            const isActive = currentTab === item.id || (hasSub && item.subItems!.some(sub => sub.id === currentTab));
            const isExpanded = expandedMenus.includes(item.id);

            return (
              <li key={item.id} className="flex flex-col">
                <button
                  onClick={() => hasSub ? toggleMenu(item.id) : setCurrentTab(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-3 text-sm font-medium transition-colors cursor-pointer",
                    isActive && !hasSub 
                      ? "bg-violet-50 text-violet-700 border-r-4 border-violet-600" 
                      : isActive && hasSub
                      ? "text-violet-700 bg-zinc-50/50"
                      : "hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? "text-violet-600" : "text-zinc-400"} />
                    {item.label}
                  </div>
                  {hasSub && (
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  )}
                </button>
                {hasSub && (
                  <div className={cn("overflow-hidden transition-all duration-200", isExpanded ? "max-h-48" : "max-h-0")}>
                    <ul className="pl-12 pr-4 py-1 space-y-1 bg-zinc-50/50">
                      {item.subItems!.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = currentTab === sub.id;
                        return (
                          <li key={sub.id}>
                            <button
                               onClick={() => setCurrentTab(sub.id)}
                               className={cn(
                                 "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                                 isSubActive 
                                   ? "bg-violet-600 text-white shadow-sm" 
                                   : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/80"
                               )}
                            >
                               <SubIcon size={16} />
                               {sub.label}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
        <div className="bg-white border border-zinc-200 rounded-lg p-3 text-xs flex flex-col gap-2 shadow-sm">
          <div className="flex justify-between items-center text-zinc-700 font-medium">
            <span>Hardware Status</span>
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="flex justify-between items-center text-zinc-500">
            <span>GPU (RTX 5070)</span>
            <span className="text-zinc-800 font-medium">45°C</span>
          </div>
          <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-violet-500 h-full w-[35%]"></div>
          </div>
          <div className="flex justify-between items-center mt-1 text-zinc-500">
            <span>RAM (64GB)</span>
            <span className="text-zinc-800 font-medium">32%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
