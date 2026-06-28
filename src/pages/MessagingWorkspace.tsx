/* oxlint-disable react-doctor/no-side-tab-border */
import { MessageSquare, Search, Send, FileImage, CreditCard, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from '../lib/firebase';
import { db, auth } from '../lib/firebase';

interface MessageLead {
  id: string;
  name: string;
  phone: string;
  type: string;
  src: string;
  note: string;
  status: string;
  createdAt?: string;
}

export default function MessagingWorkspace() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [messages, setMessages] = useState<MessageLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/messages`),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbMessages: MessageLead[] = [];
      snapshot.forEach((doc) => {
        dbMessages.push({ id: doc.id, ...doc.data() } as MessageLead);
      });
      setMessages(dbMessages);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLeads = messages.filter(lead => (lead.status || 'pending') === activeTab);
  const selectedLead = messages.find(l => l.id === selectedLeadId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-zinc-800">Workspace Nhân Viên Chăm Sóc KH (Tin nhắn / Zalo)</h3>
           <p className="text-sm text-zinc-500 mt-1">Danh sách Data chuyển từ Telesale hoặc luồng Callbot tự động cấu hình gửi SMS.</p>
        </div>
      </div>

      <div className="flex gap-4">
         <button onClick={() => setActiveTab('pending')} className={`px-5 py-2.5 rounded-xl border flex gap-2 items-center min-w-[200px] transition-colors ${activeTab === 'pending' ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 font-medium'}`}>
            <span className="flex-1 text-left">Cần gửi tin nhắn</span>
            <span className="bg-white/50 px-2 py-0.5 rounded text-sm">{loading ? '-' : messages.filter(l => (l.status || 'pending') === 'pending').length}</span>
         </button>
         <button onClick={() => setActiveTab('sent')} className={`px-5 py-2.5 rounded-xl border flex gap-2 items-center min-w-[200px] transition-colors ${activeTab === 'sent' ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 font-medium'}`}>
            <span className="flex-1 text-left">Đã gửi thành công</span>
            <span className="bg-white/50 px-2 py-0.5 rounded text-sm">{loading ? '-' : messages.filter(l => l.status === 'sent').length}</span>
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden min-h-[500px]">
           <table className="w-full text-left text-sm text-zinc-600">
             <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
               <tr>
                 <th className="px-6 py-4">Khách hàng</th>
                 <th className="px-6 py-4">Kênh Gửi</th>
                 <th className="px-6 py-4">Yêu cầu từ (Nguồn)</th>
                 <th className="px-6 py-4">Hành động</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-zinc-100">
               {loading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-zinc-500">Đang tải dữ liệu…</td>
                    </tr>
                ) : filteredLeads.length === 0 ? (
                 <tr>
                    <td colSpan={4} className="text-center py-12 text-zinc-500">
                      Không có khách hàng chờ nhận tin.
                    </td>
                 </tr>
               ) : (
                filteredLeads.map((lead) => (
                 <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`hover:bg-zinc-50 cursor-pointer ${selectedLeadId === lead.id ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-6 py-4">
                       <div className="font-semibold text-zinc-800">{lead.name}</div>
                       <div className="text-xs text-zinc-500 mt-0.5">{lead.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${(lead.type || '').includes('Zalo') ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                         <MessageSquare size={12} /> {lead.type || 'SMS'}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="font-medium text-zinc-700">{lead.src || '-'}</div>
                       <div className="text-xs text-zinc-500 max-w-[200px] truncate" title={lead.note}>Lệnh: {lead.note || 'Không có ghi chú'}</div>
                    </td>
                    <td className="px-6 py-4">
                       <ChevronRight size={18} className="text-zinc-400" />
                    </td>
                 </tr>
                ))
               )}
             </tbody>
           </table>
        </div>

        {/* Action Panel */}
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col h-[600px] overflow-hidden">
           {selectedLead ? (
              <>
                 <div className="p-5 border-b border-zinc-100 bg-zinc-50">
                    <h4 className="text-lg font-semibold text-zinc-800">{selectedLead.name}</h4>
                    <p className="text-zinc-500 text-sm font-medium">{selectedLead.phone}</p>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r text-sm text-amber-800">
                       <b>Ghi chú Yêu cầu: </b> {selectedLead.note || 'Không có yêu cầu chi tiết.'}
                    </div>

                    <div>
                       <h5 className="font-semibold text-zinc-800 mb-2 text-sm">Mẫu tin nhắn (Templates)</h5>
                       <select className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm focus:border-blue-500 outline-none bg-white">
                          <option>Mẫu 1: Gửi Báo giá Combo</option>
                          <option>Mẫu 2: Xác nhận lịch hẹn</option>
                          <option>Mẫu 3: Cảm ơn đã quan tâm</option>
                       </select>
                    </div>

                    <div>
                       <h5 className="font-semibold text-zinc-800 mb-2 text-sm">Nội dung xem trước (Preview)</h5>
                       <div className="bg-zinc-100/50 border border-zinc-200 p-4 rounded-xl text-sm text-zinc-700 relative">
                          <p>Chào anh/chị <b>{selectedLead.name}</b>,</p>
                          <p className="mt-2">Cảm ơn anh chị đã quan tâm đến dịch vụ. Em gửi anh chị bảng báo giá ưu đãi 50% dành riêng cho gia đình như file đính kèm dưới đây.</p>
                          <p className="mt-2 text-blue-600 cursor-pointer flex items-center gap-1 font-medium"><FileImage size={14} /> Bang_Gia_Combo.pdf</p>
                       </div>
                    </div>
                 </div>
                 
                 <div className="p-5 border-t border-zinc-100 bg-white grid grid-cols-2 gap-3 shrink-0">
                    <button className="col-span-2 bg-blue-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200" disabled={selectedLead.status === 'sent'}>
                       {selectedLead.status === 'sent' ? 'Đã gửi tin nhắn' : <><Send size={18} /> Xác nhận Gửi (ZNS/SMS)</>}
                    </button>
                    <button className="bg-zinc-50 text-zinc-700 border border-zinc-200 font-medium py-2.5 rounded-lg text-sm hover:bg-zinc-100 items-center justify-center flex">
                       Bỏ qua (Cancel)
                    </button>
                 </div>
              </>
           ) : (
              <div className="h-full flex items-center justify-center text-zinc-400 text-sm flex-col gap-3">
                 <MessageSquare size={40} className="text-zinc-200" />
                 <p>Chọn một khách hàng để gửi tin</p>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
