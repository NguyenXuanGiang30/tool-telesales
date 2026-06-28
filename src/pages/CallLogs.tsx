/* eslint-disable */
import { Download, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from '../lib/firebase';
import { db, auth } from '../lib/firebase';
import * as XLSX from 'xlsx';

interface CallLog {
  id: string;
  phone: string;
  duration: string;
  status: string;
  time: string;
  aiIntent: string;
  hasAudio: boolean;
  transcript?: any[];
}

export default function CallLogs() {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/call_logs`),
      where('userId', '==', auth.currentUser.uid),
      orderBy('time', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbLogs: CallLog[] = [];
      snapshot.forEach((doc) => {
        dbLogs.push({ id: doc.id, ...doc.data() } as CallLog);
      });
      setLogs(dbLogs);
      if (dbLogs.length > 0 && !selectedLogId) setSelectedLogId(dbLogs[0].id);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleExportExcel = () => {
    if (logs.length === 0) {
      alert("Không có dữ liệu để xuất.");
      return;
    }

    try {
      const exportData = logs.map(log => ({
        "Mã cuộc gọi": log.id,
        "Số điện thoại": log.phone,
        "Kết quả (AI)": log.status,
        "Ý định chi tiết": log.aiIntent,
        "Thời lượng": log.duration,
        "Thời gian gọi": formatDate(log.time)
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lịch sử cuộc gọi");
      XLSX.writeFile(wb, `Lich_su_cuoc_goi_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error("Lỗi khi xuất Excel:", error);
      alert("Đã xảy ra lỗi khi xuất file Excel.");
    }
  };

  const selectedLog = logs.find(log => log.id === selectedLogId);
  const today = new Date();

  // Logic kiểm tra 7 ngày
  let isExpired = false;
  let diffDays = 0;
  if (selectedLog) {
    const callDate = new Date(selectedLog.time);
    const diffTime = Math.abs(today.getTime() - callDate.getTime());
    diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isExpired = diffDays > 7;
  }

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return isoString; // fallback if wrong format
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-zinc-800">Lịch sử cuộc gọi (Call Logs)</h3>
        <button 
          onClick={handleExportExcel}
          className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
        >
          <Download size={18} /> Xuất Excel
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Mã cuộc gọi</th>
                  <th className="px-6 py-4">Số điện thoại</th>
                  <th className="px-6 py-4">Kết quả (AI Phân loại)</th>
                  <th className="px-6 py-4">Thời lượng</th>
                  <th className="px-6 py-4">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">Đang tải lịch sử cuộc gọi…</td>
                    </tr>
                ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">Chưa có cuộc gọi nào. Mọi lịch sử từ bot sẽ hiện ở đây.</td>
                    </tr>
                ) : (
                  logs.map((log) => (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLogId(log.id)}
                      className={`transition-colors cursor-pointer ${selectedLogId === log.id ? 'bg-violet-50/50' : 'hover:bg-zinc-50'}`}
                    >
                      <td className="px-6 py-4 font-medium text-violet-600">{log.id}</td>
                      <td className="px-6 py-4">{log.phone}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            log.status === 'Quan tâm' || log.status === 'Đồng ý' ? 'bg-green-100 text-green-700' : 
                            log.status === 'Từ chối' || log.status === 'Fail' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {log.status}
                          </span>
                          <span className="text-xs text-zinc-400 truncate max-w-[150px]" title={log.aiIntent}>{log.aiIntent}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{log.duration}</td>
                      <td className="px-6 py-4">{formatDate(log.time)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-amber-50 p-3 border-t border-amber-100 text-xs text-amber-700 flex items-center justify-center gap-2">
             <Clock size={16} /> <b>Quy định lưu trữ:</b> File ghi âm được lưu tối đa 7 ngày để tối ưu chi phí lưu trữ Cloud. Quá 7 ngày hệ thống sẽ tự động xóa file MP3 gốc, chỉ giữ lại log và lời thoại (transcript).
          </div>
        </div>

        {/* Transcript & Recording Viewer */}
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col h-[600px] overflow-hidden">
          {selectedLog ? (
            <>
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 shrink-0">
                 <div className="flex justify-between items-center mb-3">
                   <div>
                     <h4 className="font-semibold text-zinc-800">Chi tiết: {selectedLog.id}</h4>
                     <p className="text-xs text-zinc-500">{formatDate(selectedLog.time)}</p>
                   </div>
                   <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedLog.status === 'Quan tâm' || selectedLog.status === 'Đồng ý' ? 'bg-green-100 text-green-700' : 
                      selectedLog.status === 'Từ chối' || selectedLog.status === 'Fail' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {selectedLog.status}
                   </span>
                 </div>

                 {/* Audio Player Logic */}
                 {selectedLog.hasAudio ? (
                    isExpired ? (
                      <div className="bg-zinc-100 rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 border border-zinc-200">
                         <AlertCircle className="text-zinc-400" size={24} />
                         <p className="text-sm font-medium text-zinc-600">File ghi âm đã bị xóa</p>
                         <p className="text-xs text-zinc-500">Đã vượt quá thời hạn lưu trữ 7 ngày.</p>
                      </div>
                    ) : (
                      <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                        <p className="text-xs font-semibold text-violet-800 mb-2 flex justify-between">
                           <span>File ghi âm ({selectedLog.duration})</span>
                           <span className="text-violet-600/70 font-normal">Sẽ xóa sau {8 - diffDays} ngày</span>
                        </p>
                        <audio controls className="w-full h-8" preload="none">
                          <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" />
                          Trình duyệt của bạn không hỗ trợ thẻ audio.
                        </audio>
                      </div>
                    )
                 ) : (
                    <div className="bg-zinc-100 rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 border border-zinc-200">
                       <p className="text-sm font-medium text-zinc-600">Không có đoạn ghi âm</p>
                       <p className="text-xs text-zinc-500">Cuộc gọi này có thời lượng 0s hoặc gặp lỗi khởi tạo.</p>
                    </div>
                 )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {selectedLog.duration === '00:00' || !selectedLog.transcript?.length ? (
                    <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
                       Không có nội dung bóc băng (Transcript)
                    </div>
                 ) : (
                    selectedLog.transcript.map((msg: any, i: number) => (
                      <div key={`item-${i}`} className={`flex flex-col gap-1 items-${msg.sender === 'bot' ? 'start' : 'end'}`}>
                        <span className={`text-xs font-bold ${msg.sender === 'bot' ? 'text-violet-600' : 'text-emerald-600'}`}>
                          {msg.sender === 'bot' ? 'AI Bot' : 'Khách hàng'}
                        </span>
                        <div className={`p-3 text-sm rounded-lg ${msg.sender === 'bot' ? 'bg-violet-50 text-zinc-800 rounded-tl-none' : 'bg-zinc-100 text-zinc-800 rounded-tr-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                 )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-400 text-sm p-4 text-center">
              Vui lòng chọn một cuộc gọi bên trái để xem chi tiết
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
