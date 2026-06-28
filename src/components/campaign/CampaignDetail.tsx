import { useState } from 'react';
import { ArrowLeft, Map, GitMerge, Phone, Save } from 'lucide-react';
import FlowBuilder from '../FlowBuilder';
import StrategyPipeline from './StrategyPipeline';

interface CampaignDetailProps {
  campaignName: string;
  campaignId: string;
  onBack: () => void;
}

export default function CampaignDetail({ campaignName, campaignId, onBack }: CampaignDetailProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'flow'>('pipeline');

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6 bg-zinc-50 relative z-10 w-[calc(100%+48px)]">
      {/* Header */}
      <div className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-20">
         <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-zinc-100 rounded-md text-zinc-500 transition-colors">
               <ArrowLeft size={18} />
            </button>
            <div>
               <h3 className="font-semibold text-zinc-800 text-sm">{campaignName}</h3>
               <p className="text-[10px] text-violet-600 font-medium tracking-wide uppercase">Setup Chiến Dịch Đa Tầng</p>
            </div>
         </div>
         
         <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('pipeline')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors \${activeTab === 'pipeline' ? 'bg-white text-violet-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              <Map size={16} /> Khung tư duy Campaign
            </button>
            <button 
              onClick={() => setActiveTab('flow')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors \${activeTab === 'flow' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              <GitMerge size={16} /> Kịch bản Callbot chi tiết
            </button>
         </div>

         <div className="flex items-center gap-2">
            <button className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors hover:bg-emerald-100">
              <Phone size={14} /> Chạy thử AI
            </button>
            <button 
               onClick={() => {
                 if (activeTab === 'flow') {
                   document.dispatchEvent(new CustomEvent('saveCampaign'));
                 } else {
                   // If not on flow tab, switch to it and then trigger save
                   setActiveTab('flow');
                   setTimeout(() => {
                     document.dispatchEvent(new CustomEvent('saveCampaign'));
                   }, 300); // 300ms delay to allow component to render
                 }
               }}
               className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Save size={14} /> Lưu chiến dịch
            </button>
         </div>
      </div>
      
      {/* Content area */}
      <div className="flex-1 w-full relative overflow-y-auto bg-zinc-50">
         {activeTab === 'pipeline' ? <StrategyPipeline /> : null}
         {activeTab === 'flow' ? <FlowBuilder campaignId={campaignId} /> : null}
      </div>
    </div>
  );
}
