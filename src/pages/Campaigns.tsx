/* oxlint-disable react-doctor/prefer-useReducer, react-doctor/no-giant-component */
import { Play, Square, Settings, MoreVertical, Plus, Copy, Trash2, PieChart, AlertTriangle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import CampaignDetail from '../components/campaign/CampaignDetail';
import CampaignReport from '../components/campaign/CampaignReport';
import {
  createCampaign,
  deleteCampaign,
  getCampaignFlow,
  listCampaigns,
  saveCampaignFlow,
  updateCampaign,
} from '../lib/api';

interface CampaignType {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed';
  progress: number;
  total: number;
  script: string;
}

interface CampaignsProps {
  title?: string;
  type?: 'callbot' | 'telesale' | 'messages';
}

export default function Campaigns({
  title = 'Danh sách chiến dịch', type = 'callbot' }: CampaignsProps) {
  const [view, setView] = useState<'list' | 'builder' | 'report'>('list');
  const [editingName, setEditingName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [items, setItems] = useState<CampaignType[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [error, setError] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCampaigns = async () => {
      setLoading(true);
      setError('');
      try {
        const dbItems = await listCampaigns(type);
        if (!cancelled) setItems(dbItems as CampaignType[]);
      } catch (err) {
        console.error("Error loading campaigns", err);
        if (!cancelled) {
          setError('Không kết nối được Backend API. Hãy đảm bảo bạn đã bật server Python (chạy file main.py).');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const handleCreate = async () => {
    // if (type === 'callbot') {
    //    const systemReady = localStorage.getItem('systemReady') === 'true';
    //    
    //    if (!systemReady) {
    //       setShowConfigWarning(true);
    //       return;
    //    }
    // }

    const newName = `Chiến dịch ${type === 'callbot' ? 'Callbot' : type === 'telesale' ? 'Telesale' : 'Tin nhắn'} mới`;
    
    // We navigate to builder immediately, we can save it later or just set editingName.
    // For proper persistence, let's create a draft doc first
    try {
       setError('');
       const docRef = await createCampaign({
          name: newName,
          status: 'paused',
          progress: 0,
          total: 0,
          script: 'Chưa cấu hình',
          type: type,
       });
       setEditingName(newName);
       setEditingId(docRef.id);
       setView('builder');
    } catch(err) {
       console.error("Error creating campaign", err);
       setError('Tạo chiến dịch thất bại. Backend API chưa sẵn sàng. Vui lòng bật server Python.');
    }
  };

  const handleEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
    setView('builder');
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    let newStatus: CampaignType['status'] = currentStatus === 'running' ? 'paused' : 'running';
    if (currentStatus === 'completed') newStatus = 'running';
    
    try {
      const updated = await updateCampaign(id, { status: newStatus });
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...updated } as CampaignType : item));
    } catch(err) {
      console.error(err);
      setError('Không cập nhật được trạng thái chiến dịch. API lỗi.');
    }
  };

  const confirmDelete = async () => {
    if (campaignToDelete) {
       try {
         await deleteCampaign(campaignToDelete);
         setItems(prev => prev.filter(item => item.id !== campaignToDelete));
         setCampaignToDelete(null);
       } catch(err) {
         console.error(err);
         setError('Xóa chiến dịch thất bại. API lỗi.');
       }
    }
  };

  const duplicateCampaign = async (camp: CampaignType) => {
    try {
       const newCampRef = await createCampaign({
          name: `${camp.name} (Bản sao)`,
          status: 'paused',
          progress: 0,
          total: camp.total,
          script: camp.script,
          type: type,
       });
       
       // Clone flow data if it exists
       const flowData = await getCampaignFlow(camp.id);
       if (flowData.nodes || flowData.edges) {
           await saveCampaignFlow(newCampRef.id, {
             nodes: flowData.nodes || '[]',
             edges: flowData.edges || '[]',
           });
       }

       setItems(prev => [newCampRef as CampaignType, ...prev]);
       setOpenMenuId(null);
    } catch(err) {
       console.error(err);
       setError('Nhân bản chiến dịch thất bại. API lỗi.');
    }
  };

  if (view === 'builder') {
    return <CampaignDetail campaignName={editingName} campaignId={editingId} onBack={() => setView('list')} />;
  }
  
  if (view === 'report') {
    return <CampaignReport campaignName={editingName} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-zinc-800">{title}</h3>
        <div className="flex items-center gap-2">
          <button onClick={handleCreate} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
            <Plus size={18} /> Tạo chiến dịch {type === 'callbot' ? 'Callbot' : type === 'telesale' ? 'Telesale' : 'Tin nhắn'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
            <tr>
              <th className="px-6 py-4">Tên chiến dịch</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4">Tiến độ</th>
              <th className="px-6 py-4">Kịch bản (Script)</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
               <tr>
                 <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    Đang tải dữ liệu chiến dịch...
                 </td>
               </tr>
            ) : items.length === 0 ? (
               <tr>
                 <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    Chưa có chiến dịch nào. Hãy nhấn Tạo chiến dịch bên trên.
                 </td>
               </tr>
            ) : items.map((camp) => (
              <tr key={camp.id} onClick={() => handleEdit(camp.id, camp.name)} className="hover:bg-zinc-50 transition-colors cursor-pointer">
                <td className="px-6 py-4 font-medium text-zinc-800">{camp.name}</td>
                <td className="px-6 py-4">
                  {camp.status === 'running' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold"><span className="size-1.5 rounded-full bg-green-500 animate-pulse"></span> Đang chạy</span>}
                  {camp.status === 'paused' && <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 text-xs font-semibold">Tạm dừng</span>}
                  {camp.status === 'completed' && <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold">Hoàn thành</span>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-full bg-zinc-100 rounded-full h-2 max-w-[100px]">
                      <div className={`h-2 rounded-full ${camp.status === 'completed' ? 'bg-zinc-400' : 'bg-violet-500'}`} style={{ width: `${camp.total > 0 ? (camp.progress / camp.total) * 100 : 0}%` }}></div>
                    </div>
                    <span className="text-xs font-medium text-zinc-500">{camp.total > 0 ? Math.round((camp.progress / camp.total) * 100) : 0}% ({camp.progress}/{camp.total})</span>
                  </div>
                </td>
                <td className="px-6 py-4">{camp.script}</td>
                <td className="px-6 py-4 text-right relative">
                  <div className="flex items-center justify-end gap-2">
                    {camp.status === 'running' ? (
                       <button onClick={(e) => { e.stopPropagation(); toggleStatus(camp.id, camp.status); }} className="p-1.5 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors" title="Dừng chiến dịch">
                         <Square size={18} />
                       </button>
                    ) : (
                       <button onClick={(e) => { e.stopPropagation(); toggleStatus(camp.id, camp.status); }} className={`p-1.5 ${camp.status === 'completed' ? 'text-zinc-300 pointer-events-none' : 'text-zinc-400 hover:text-green-500 hover:bg-green-50'} rounded transition-colors`} title="Phát lại">
                         <Play size={18} />
                       </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(camp.id, camp.name); }} className="p-1.5 text-zinc-400 hover:text-violet-500 hover:bg-zinc-100 rounded transition-colors" title="Cấu hình kịch bản">
                      <Settings size={18} />
                    </button>
                    
                    <div className="relative">
                       <button 
                         onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === camp.id ? null : camp.id); }}
                         className={`p-1.5 rounded transition-colors ${openMenuId === camp.id ? 'bg-violet-50 text-violet-600' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'}`}
                       >
                         <MoreVertical size={18} />
                       </button>
                       
                       {openMenuId === camp.id && (
                          <div ref={menuRef} className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-zinc-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                             <button onClick={(e) => { e.stopPropagation(); setEditingId(camp.id); setEditingName(camp.name); setView('report'); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-violet-600 flex items-center gap-2 transition-colors">
                               <PieChart size={16} /> Xem báo cáo
                             </button>
                             <button onClick={(e) => { e.stopPropagation(); duplicateCampaign(camp); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-violet-600 flex items-center gap-2 transition-colors">
                               <Copy size={16} /> Nhân bản
                             </button>
                             <div className="h-px bg-zinc-100 my-1"></div>
                             <button 
                               onClick={(e) => { e.stopPropagation(); setCampaignToDelete(camp.id); setOpenMenuId(null); }} 
                               className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                             >
                               <Trash2 size={16} /> Xóa chiến dịch
                             </button>
                          </div>
                       )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Configuration Warning Modal */}
      {showConfigWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="size-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-semibold text-zinc-800 mb-2 text-center">Yêu cầu cấu hình hệ thống</h3>
              <p className="text-zinc-600 text-sm text-center mb-6">Bạn chưa hoàn tất cấu hình phần cứng hoặc mô hình AI. Vui lòng thực hiện các bước sau để tạo Callbot:</p>
              
              <div className="space-y-3">
                 <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                    <div className={`mt-0.5 ${localStorage.getItem('systemReady') === 'true' ? 'text-emerald-500' : 'text-zinc-400'}`}>
                       {localStorage.getItem('systemReady') === 'true' ? <div className="bg-emerald-500 rounded-full size-4 flex items-center justify-center text-white text-[10px] font-bold">✓</div> : <div className="border-2 border-zinc-300 rounded-full size-4"></div>}
                    </div>
                    <div>
                       <p className="font-medium text-zinc-800 text-sm">1. Cấu hình SIP Trunk hoặc GSM Gateway</p>
                       <p className="text-xs text-zinc-500">Mở "Hệ thống (Hardware/GSM)" để thêm cấu hình kết nối viễn thông.</p>
                    </div>
                 </div>
                 

              </div>
            </div>
            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button 
                onClick={() => setShowConfigWarning(false)}
                className="px-6 py-2.5 bg-zinc-200 text-zinc-700 hover:bg-zinc-300 rounded-xl font-medium transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="size-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-semibold text-zinc-800 mb-2">Xóa chiến dịch?</h3>
              <p className="text-zinc-600 text-sm mb-6">Bạn có chắc chắn muốn xóa chiến dịch này không? Không thể hoàn tác hành động này.</p>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setCampaignToDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
