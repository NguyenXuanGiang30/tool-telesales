import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, Tag, PhoneForwarded, Bell, Play, Zap, Maximize2 } from 'lucide-react';

export default function BotActionNode({ id, selected, data }: any) {
  const { setNodes } = useReactFlow();

  const handleDelete = () => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
  };

  const getIcon = () => {
    switch (data.actionType) {
      case 'label': return <Tag size={14} />;
      case 'transfer': return <PhoneForwarded size={14} />;
      case 'notify': return <Bell size={14} />;
      case 'trigger': return <Zap size={14} />;
      case 'start': return <Play size={14} />;
      default: return <Zap size={14} />;
    }
  };

  const getTitle = () => {
    switch (data.actionType) {
      case 'label': return 'Gắn Nhãn';
      case 'transfer': return 'Chuyển Máy';
      case 'notify': return 'Thông Báo';
      case 'trigger': return 'Kích Hoạt';
      case 'start': return 'Bắt Đầu';
      default: return 'Bot Action';
    }
  };

  const getColorClass = () => {
    if (data.actionType === 'trigger') return 'bg-teal-100 text-teal-700';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg border-2 min-w-[250px] overflow-hidden \${selected ? 'border-amber-500' : 'border-transparent'}`}>
      <Handle type="target" position={Position.Left} className="size-3 bg-white border-2 border-zinc-400" />
      
      <div className="p-3 bg-white border-b border-zinc-100 flex items-center justify-between">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
           System Event
        </div>
        <div className="flex gap-2">
          <button onClick={handleDelete} className="text-zinc-400 hover:text-red-500 transition-colors p-1" title="Xóa thẻ">
            <Trash2 size={16} />
          </button>
          <button className="text-zinc-400 hover:text-violet-500 transition-colors p-1" title="Chỉnh sửa chi tiết">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className={`text-xs font-semibold px-2 py-1 rounded inline-flex items-center gap-1 ${getColorClass()}`}>
            {getIcon()} {getTitle()}
          </div>
          {data.actionType === 'label' && (
             <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">AI Auto Tag</span>
          )}
        </div>

        <div className="mt-2">
           <input 
              type="text" 
              defaultValue={data.text || ""}
              className={`w-full text-sm border rounded py-2 px-3 outline-none text-zinc-700 ${data.actionType === 'label' ? 'border-amber-200 bg-amber-50/30 focus:border-amber-400' : 'border-zinc-200 bg-zinc-50/50 focus:border-amber-400'}`}
              placeholder={data.placeholder || "Nội dung hành động..."}
           />
           {data.actionType === 'label' && (
             <p className="text-[10px] text-zinc-400 mt-1 italic leading-tight">
                * LLM sẽ phân tích toàn bộ hội thoại và tự động quyết định xem nhãn này có phù hợp để gắn hay không.
             </p>
           )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="size-3 bg-white border-2 border-zinc-400" />
    </div>
  );
}
