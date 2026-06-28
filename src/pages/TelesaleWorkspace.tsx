/* oxlint-disable react-doctor/prefer-useReducer */
import { Phone, CheckCircle, XCircle, MessageSquare, Clock, Filter, Search, FileText, Smartphone } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, updateDoc, doc, serverTimestamp } from '../lib/firebase';
import { db, auth } from '../lib/firebase';
import AICallModal from '../components/campaign/AICallModal';

interface TelesaleLead {
  id: string;
  name: string;
  phone: string;
  campaign: string;
  botIntent: string;
  status: string;
  createdAt: string;
  note?: string;
}

export default function TelesaleWorkspace() {
  const [activeTab, setActiveTab] = useState('new');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leads, setLeads] = useState<TelesaleLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAiCallModal, setShowAiCallModal] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/leads`),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbLeads: TelesaleLead[] = [];
      snapshot.forEach((doc) => {
        dbLeads.push({ id: doc.id, ...doc.data() } as TelesaleLead);
      });
      setLeads(dbLeads);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLeads = leads.filter(lead => {
    if (activeTab === 'new') return lead.status === 'new';
    if (activeTab === 'calling') return lead.status === 'calling';
    if (activeTab === 'done') return ['success', 'rejected', 'transferred'].includes(lead.status);
    return true;
  });

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-zinc-800">Workspace Nhân Viên Telesale</h3>
           <p className="text-sm text-zinc-500 mt-1">Danh sách Data đã được Callbot màng lọc "Khách Quan Tâm" chuyển sang.</p>
        </div>
        <div className="flex gap-2">
           <button className="bg-white border border-zinc-200 text-zinc-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-zinc-50">
             <Filter size={16} /> Lọc dữ liệu
           </button>
        </div>
      </div>

      {/* Stats/Tabs */}
      <div className="flex gap-4">
         <button onClick={() => setActiveTab('new')} className={`px-5 py-3 rounded-xl border flex flex-col items-start min-w-[150px] transition-colors ${activeTab === 'new' ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
            <span className="text-2xl font-bold">{loading ? '-' : leads.filter(l => l.status === 'new').length}</span>
            <span className="text-sm font-medium">Khách mới từ Bot</span>
         </button>
         <button onClick={() => setActiveTab('calling')} className={`px-5 py-3 rounded-xl border flex flex-col items-start min-w-[150px] transition-colors ${activeTab === 'calling' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
            <span className="text-2xl font-bold">{loading ? '-' : leads.filter(l => l.status === 'calling').length}</span>
            <span className="text-sm font-medium">Đang bám sát</span>
         </button>
         <button onClick={() => setActiveTab('done')} className={`px-5 py-3 rounded-xl border flex flex-col items-start min-w-[150px] transition-colors ${activeTab === 'done' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
            <span className="text-2xl font-bold">{loading ? '-' : leads.filter(l => ['success', 'rejected', 'transferred'].includes(l.status)).length}</span>
            <span className="text-sm font-medium">Đã xử lý xong</span>
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden min-h-[500px]">
           <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="relative w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                 <input type="text" placeholder="Tìm tên, SĐT khách hàng…" className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm focus:border-violet-500 outline-none" />
              </div>
           </div>
           
           <table className="w-full text-left text-sm text-zinc-600">
             <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
               <tr>
                 <th className="px-6 py-4">Khách hàng</th>
                 <th className="px-6 py-4">Phân tích từ Bot</th>
                 <th className="px-6 py-4">Chiến dịch gốc</th>
                 <th className="px-6 py-4">Thao tác</th>
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
                      Không có data nào trong mục này.
                    </td>
                 </tr>
               ) : (
                filteredLeads.map((lead) => (
                 <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className={`hover:bg-zinc-50 cursor-pointer ${selectedLeadId === lead.id ? 'bg-violet-50/40' : ''}`}>
                    <td className="px-6 py-4">
                       <div className="font-semibold text-zinc-800">{lead.name}</div>
                       <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5"><Phone size={12}/> {lead.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="inline-flex bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full text-xs font-medium">
                         {lead.botIntent || 'Quan tâm'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{lead.campaign || '-'}</td>
                    <td className="px-6 py-4">
                       <button className="bg-violet-600 text-white p-2 rounded hover:bg-violet-700" title="Gọi thủ công">
                         <Phone size={16} />
                       </button>
                    </td>
                 </tr>
                ))
               )}
             </tbody>
           </table>
        </div>

        {/* Panel Chi tiết */}
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col h-[600px] overflow-hidden">
           {selectedLead ? (
              <>
                 <div className="p-5 border-b border-zinc-100 bg-zinc-50">
                    <h4 className="text-lg font-semibold text-zinc-800">{selectedLead.name}</h4>
                    <p className="text-zinc-500 text-sm font-medium">{selectedLead.phone}</p>
                    <div className="mt-3 flex gap-2">
                       <span className="text-xs px-2 py-1 bg-zinc-200 text-zinc-700 rounded font-medium">{selectedLead.id}</span>
                       {selectedLead.campaign && <span className="text-xs px-2 py-1 bg-violet-100 text-violet-700 rounded font-medium">{selectedLead.campaign}</span>}
                    </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    <div>
                       <h5 className="font-semibold text-zinc-800 mb-2 flex items-center gap-2 text-sm"><FileText size={16} className="text-violet-600"/> Note từ Callbot</h5>
                       <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-lg text-sm text-zinc-700">
                         {selectedLead.note || 'Không có ghi chú.'}
                       </div>
                    </div>
                    
                    <div>
                       <h5 className="font-semibold text-zinc-800 mb-2 text-sm">Ghi chú của Telesale</h5>
                       <textarea className="w-full border border-zinc-300 rounded-lg p-3 text-sm min-h-[100px] focus:border-violet-500 outline-none" placeholder="Nhập tóm tắt cuộc gọi thủ công của bạn vào đây…"></textarea>
                    </div>
                 </div>
                 
                 <div className="p-5 border-t border-zinc-100 bg-white grid grid-cols-2 gap-3 shrink-0">
                    <button onClick={() => setShowAiCallModal(true)} className="col-span-2 bg-violet-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
                       <Phone size={18} /> Bắt đầu gọi cho khách (Bằng AI Local)
                    </button>
                    
                    <button className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors">
                       <CheckCircle size={16} /> Chốt Sale thành công
                    </button>
                    <button className="bg-blue-50 text-blue-700 border border-blue-200 font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors">
                       <MessageSquare size={16} /> Chuyển Gửi SMS/Zalo
                    </button>
                    <button className="bg-amber-50 text-amber-700 border border-amber-200 font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors">
                       <Clock size={16} /> Khách bận, Hẹn gọi lại
                    </button>
                    <button className="bg-red-50 text-red-700 border border-red-200 font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors">
                       <XCircle size={16} /> Khách không mua
                    </button>
                 </div>
              </>
           ) : (
              <div className="h-full flex items-center justify-center text-zinc-400 text-sm flex-col gap-3">
                 <Search size={40} className="text-zinc-200" />
                 <p>Chọn một khách hàng để xem chi tiết & thao tác</p>
              </div>
           )}
        </div>
      </div>

      {showAiCallModal && selectedLead && (
         <AICallModal 
            leadName={selectedLead.name}
            leadPhone={selectedLead.phone}
            onClose={() => setShowAiCallModal(false)}
            onComplete={async (status, note) => {
                if (auth.currentUser) {
                    try {
                        await updateDoc(doc(db, `users/${auth.currentUser.uid}/leads/${selectedLead.id}`), {
                            status,
                            note: `${selectedLead.note || ''}\n\n[Kết quả AI Call] ${note}`.trim(),
                            updatedAt: serverTimestamp()
                        });
                        if (status === 'no-answer') {
                           alert('Khách hàng không bắt máy. Đã tự động cập nhật trạng thái kết thúc.');
                        } else {
                           alert(`Đã hoàn thành cuộc gọi bằng AI Local! \nTrạng thái: ${status}`);
                        }
                    } catch (error) {
                        console.error(error);
                    }
                }
            }}
         />
      )}
    </div>
  );
}
