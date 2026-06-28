/* eslint-disable */
/* oxlint-disable react-doctor/no-pure-black-background */
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Headphones, Trash2, Plus, Maximize2 } from 'lucide-react';

export default function BotListenNode({ id, selected, data }: any) {
  const { setNodes } = useReactFlow();

  const handleDelete = () => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
  };
  return (
    <div className={`bg-white rounded-xl shadow-lg border-2 min-w-[280px] overflow-hidden ${selected ? 'border-green-500' : 'border-transparent'}`}>
      <Handle type="target" position={Position.Left} className="size-3 bg-white border-2 border-zinc-400" />
      
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded inline-flex items-center gap-1">
            <Headphones size={14} /> Bot Nghe
          </div>
          <div className="flex gap-2 text-zinc-400">
            <button onClick={handleDelete} className="hover:text-red-500 transition-colors p-1" title="Xóa thẻ">
              <Trash2 size={16} />
            </button>
            <button className="hover:text-violet-500 transition-colors p-1" title="Chỉnh sửa chi tiết">
              <Maximize2 size={16} />
            </button>
            <button className="bg-black text-white p-0.5 rounded hover:bg-zinc-800 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-2">
             <input 
                type="text" 
                defaultValue={data.intentName || "hỏi quan tâm"}
                className="flex-1 text-sm border-none bg-transparent outline-none text-zinc-700 placeholder-zinc-400 font-medium"
                placeholder="Tên nhóm ý định"
             />
             <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold border border-violet-200 shadow-sm" title="AI tự động phân tích ý định ngôn ngữ tự nhiên">AI Mode</span>
           </div>
           
           <div className="flex bg-zinc-50 border border-zinc-200 rounded overflow-hidden mt-1">
             <input type="number" defaultValue="3" className="w-12 border-none bg-transparent p-1.5 text-center text-sm outline-none text-zinc-600" />
             <div className="flex-1 border-l border-zinc-200 p-1.5 text-sm text-zinc-500 px-3 bg-white">Giây chờ phản hồi</div>
           </div>
        </div>

        {/* Branches */}
        <div className="mt-2 flex flex-col gap-3 relative border-t border-dashed border-zinc-200 pt-3">
           
           {data.branches && data.branches.map((branch: any, idx: number) => (
             <div key={`item-${idx}`} className="relative group bg-zinc-50/50 p-2 rounded-lg border border-zinc-100">
                <div className="text-[11px] font-bold text-violet-500/80 mb-1 flex items-center gap-1">
                   {/* Sparkle icon for AI */}
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                   LLM Match (Prompt)
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                  {branch.keywords.map((kw: string, i: number) => (
                    <span key={`item-${i}`} className="bg-violet-50 border border-violet-100 text-violet-700 text-[11px] px-2 py-0.5 rounded shadow-sm">
                      Mô tả: "{kw}"
                    </span>
                  ))}
                  {branch.allowInput && (
                    <span className="text-zinc-400 text-xl font-thin leading-none relative -top-0.5 ml-1 animate-pulse">|</span>
                  )}
                </div>
                {branch.isDeleteable && (
                   <div className="absolute top-1/2 -left-6 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button className="text-zinc-400 hover:text-red-500">
                       <Trash2 size={14} />
                     </button>
                   </div>
                )}
                <Handle 
                  type="source" 
                  position={Position.Right} 
                  id={`handle-${idx}`}
                  className="size-3 bg-white border-2 border-zinc-400 !right-[-23px] top-1/2 -translate-y-1/2" 
                />
             </div>
           ))}

           {/* Default / Fallback Branch */}
           <div className="relative mt-2">
              <div className="text-xs text-red-400 font-medium text-right w-full pr-1">Mặc định</div>
              <Handle 
                type="source" 
                position={Position.Right} 
                id="handle-default"
                className="size-3 bg-white border-2 border-zinc-400 !right-[-23px] top-0" 
              />
           </div>

        </div>

      </div>
    </div>
  );
}
