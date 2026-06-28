/* oxlint-disable react-doctor/prefer-dynamic-import */
import React from 'react';
import { ArrowLeft, Phone, PhoneForwarded, Clock, CheckCircle, XCircle, PieChart, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Cell } from 'recharts';
import * as XLSX from 'xlsx';

export default function CampaignReport({ campaignName, onBack }: { campaignName: string, onBack: () => void }) {
  const metrics = [
    { label: "Tổng cuộc gọi", value: "0", trend: "0%", color: "text-blue-600", bg: "bg-blue-50", icon: <Phone size={20} /> },
    { label: "Trả lời thành công", value: "0", trend: "0%", color: "text-emerald-600", bg: "bg-emerald-50", icon: <CheckCircle size={20} /> },
    { label: "Không nghe máy/Từ chối", value: "0", trend: "0%", color: "text-rose-600", bg: "bg-rose-50", icon: <XCircle size={20} /> },
    { label: "Thời lượng gọi TB", value: "0s", trend: "0s", color: "text-violet-600", bg: "bg-violet-50", icon: <Clock size={20} /> },
  ];

  const chartData = [
    { name: 'Khách quan tâm', value: 0, color: '#10b981' }, 
    { name: 'Cần gọi lại', value: 0, color: '#f59e0b' },    
    { name: 'Không có nhu cầu', value: 0, color: '#8b5cf6' },
    { name: 'Sai số/Thuê bao', value: 0, color: '#f43f5e' } 
  ];

  const handleExportExcel = () => {
    // Empty dataset for now
    const dataToExport = [{
      'STT': '',
      'Số điện thoại': '',
      'Trạng thái gọi': '',
      'Nhận diện (AI)': '',
      'Thời lượng': '',
      'Ngày gọi': ''
    }];

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },  // STT
      { wch: 15 }, // SĐT
      { wch: 20 }, // Trạng thái
      { wch: 20 }, // Nhận diện
      { wch: 15 }, // Thời lượng
      { wch: 25 }, // Ngày gọi
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCaoChienDich");
    
    const safeName = campaignName.replace(/[^a-zA-Z0-9]/g, '_') || 'Campaign';
    XLSX.writeFile(workbook, `BaoCao_${safeName}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 relative animate-in fade-in z-20">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between shrink-0 top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 flex items-center gap-2">
              <PieChart className="text-violet-600" size={24} />
              Báo cáo: {campaignName}
            </h2>
            <div className="text-sm text-zinc-500 font-medium">Chi tiết hiệu quả chiến dịch tự động</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-200">
             <Download size={16} /> Xuất Excel
           </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto w-full space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, idx) => (
             <div key={m.label} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-start gap-4">
               <div className={`p-3 rounded-xl ${m.bg} ${m.color}`}>
                 {m.icon}
               </div>
               <div>
                 <p className="text-sm font-semibold text-zinc-500">{m.label}</p>
                 <div className="flex items-end gap-2 mt-1">
                   <h3 className="text-2xl font-semibold text-zinc-800">{m.value}</h3>
                   <span className={`text-xs font-bold mb-1 ${m.trend.includes('+') || m.trend.includes('%') && parseInt(m.trend) > 50 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                     {m.trend}
                   </span>
                 </div>
               </div>
             </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* Chart Section */}
           <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col h-[400px]">
              <h3 className="text-base font-semibold text-zinc-800 mb-6 shrink-0">Phân loại cuộc gọi (AI nhận diện)</h3>
              <div className="flex-1 w-full relative" style={{ minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <RechartsTooltip 
                       cursor={{ fill: '#F1F5F9' }}
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} 
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Top Contacts Section */}
           <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col h-[400px]">
              <h3 className="text-base font-semibold text-zinc-800 mb-4 shrink-0">Cuộc gọi gần nhất</h3>
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                 <p className="text-sm">Chưa có cuộc gọi nào</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
