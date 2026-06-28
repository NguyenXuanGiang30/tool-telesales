import { Target, Activity, Zap, FileText, CheckCircle2, RefreshCcw, FileJson } from 'lucide-react';

const steps = [
  { id: 'input', name: '1. Input', desc: 'Thu thập dữ liệu', goal: 'Hiểu thị trường', action: 'Crawl dữ liệu, đọc insight', keywords: 'customer insight, market research, pain point', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'analysis', name: '2. Phân tích', desc: 'Insight', goal: 'Hiểu khách hàng là ai', action: 'Segment, phân loại Persona', keywords: 'target audience, persona, behavior', icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { id: 'strategy', name: '3. Chiến lược', desc: 'Hướng đi', goal: 'Quyết định hướng đi', action: 'Chọn kênh, cài thông điệp', keywords: 'marketing strategy, USP, value prop', icon: Target, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { id: 'execution', name: '4. Triển khai', desc: 'Thực thi bot', goal: 'Tạo nội dung / Gọi AutoCall', action: 'Viết content, Chạy Agent Bot', keywords: 'content marketing, outbound call, fb ads', icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  { id: 'evaluation', name: '5. Đánh giá', desc: 'Phân tích KPIs', goal: 'Đo lường hiệu quả', action: 'Track KPI, Thống kê', keywords: 'CTR, conversion rate, ROI', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'optimization', name: '6. Tối ưu', desc: 'A/B Testing', goal: 'Cải thiện Kịch bản', action: 'A/B test, Fine-tune Model', keywords: 'optimization, A/B testing, scale', icon: RefreshCcw, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
];

export default function StrategyPipeline() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      <div className="flex items-start justify-between">
        <div className="max-w-2xl">
           <h2 className="text-2xl font-semibold text-zinc-800">Khung tư duy: Campaign Flow</h2>
           <p className="text-zinc-600 mt-2">Định nghĩa chiến dịch thành một pipeline các node để AI "hiểu hành trình" từ điểm bắt đầu đến mục tiêu cuối. Tránh lỗi chỉ đưa từ khóa mà phải thiết lập cả Flow + Context.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative">
         {steps.map((step, idx) => {
           const Icon = step.icon;
           return (
             <div key={step.id} className={`rounded-xl border ${step.border} bg-white shadow-sm overflow-hidden flex flex-col`}>
                <div className={`${step.bg} p-4 border-b ${step.border} flex items-center justify-between`}>
                   <div className="flex items-center gap-3">
                     <div className={`size-8 rounded-full bg-white shadow-sm flex items-center justify-center ${step.color}`}>
                       <Icon size={16} />
                     </div>
                     <div>
                       <h3 className={`font-semibold ${step.color} text-sm uppercase tracking-wide`}>{step.name}</h3>
                       <p className="text-xs text-zinc-600">{step.desc}</p>
                     </div>
                   </div>
                </div>
                <div className="p-5 space-y-4 grow">
                   <div>
                     <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Mục tiêu (Goal)</span>
                     <p className="text-sm font-medium text-zinc-800">{step.goal}</p>
                   </div>
                   <div>
                     <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Hành động (Action)</span>
                     <p className="text-sm text-zinc-700">{step.action}</p>
                   </div>
                   <div>
                     <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Từ khóa (Keywords)</span>
                     <div className="flex flex-wrap gap-1.5 mt-1">
                        {step.keywords.split(', ').map((kw) => (
                           <span key={kw} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${step.bg} ${step.color} border ${step.border}`}>
                             "{kw}"
                           </span>
                        ))}
                     </div>
                   </div>
                </div>
             </div>
           )
         })}
      </div>

      <div className="mt-8 bg-zinc-900 rounded-xl shadow-lg border border-zinc-700 overflow-hidden flex flex-col lg:flex-row">
         <div className="p-6 lg:p-8 bg-zinc-800/50 border-b lg:border-b-0 lg:border-r border-zinc-700 lg:w-1/3 flex flex-col justify-center">
            <FileJson className="text-violet-400 mb-4" size={32} />
            <h3 className="text-lg font-semibold text-white mb-2">Machine-readable JSON</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Cách giúp AI (LLM) không "lạc đường" bằng việc nạp cấu trúc Flow kèm Keyword vào System Prompt khi khởi chạy Campaign.
            </p>
            <p className="text-xs text-emerald-400 font-mono">✓ Tích hợp làm Context Core.</p>
         </div>
         <div className="lg:w-2/3 p-6 lg:p-8 text-sm font-mono leading-relaxed overflow-x-auto text-emerald-300">
<pre>{`{
  "campaign": [
    {
      "step": "input",
      "goal": "market understanding",
      "keywords": ["customer insight", "pain point"]
    },
    {
      "step": "analysis",
      "goal": "define audience",
      "keywords": ["persona", "behavior"]
    },
    {
      "step": "strategy",
      "goal": "marketing strategy",
      "keywords": ["USP", "value proposition"]
    }
  ]
}`}</pre>
         </div>
      </div>
    </div>
  );
}
