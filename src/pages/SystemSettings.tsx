/* eslint-disable */
import { PhoneCall, Network, ShieldCheck, Activity, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { testGsmConnection } from '../lib/api';

interface GatewayConfig {
  id: string;
  type: 'SIP' | 'GSM';
  name: string;
  ip: string;
  port: string;
  username?: string;
  password?: string;
  status: 'idle' | 'testing' | 'ok' | 'error';
}

export default function SystemSettings() {
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing configuration locally. The GSM dashboard is a bundled desktop module.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('autocall.system.gateways');
      if (saved) setGateways(JSON.parse(saved));
    } catch (error) {
      console.error("Lỗi khi tải cài đặt hệ thống:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addGateway = (type: 'SIP' | 'GSM') => {
    const newGw: GatewayConfig = {
      id: Math.random().toString(36).substring(7),
      type,
      name: `Cấu hình ${type} mới`,
      ip: '',
      port: type === 'SIP' ? '5060' : '',
      status: 'idle'
    };
    setGateways(prev => [...prev, newGw]);
  };

  const updateGateway = (id: string, field: keyof GatewayConfig, value: string) => {
    setGateways(prev => prev.map(gw => gw.id === id ? { ...gw, [field]: value } : gw));
  };

  const deleteGateway = (id: string) => {
    const newGateways = gateways.filter(gw => gw.id !== id);
    setGateways(newGateways);
    if (newGateways.length === 0) {
       localStorage.removeItem('systemReady');
    }
  };

  const testConnection = async (id: string) => {
    const gw = gateways.find(g => g.id === id);
    if (!gw) return;

    updateGateway(id, 'status', 'testing');

    if (gw.type === 'GSM') {
      try {
        const baudRate = gw.port.includes(',') ? parseInt(gw.port.split(',')[1]) : 115200;
        const portName = gw.port.includes(',') ? gw.port.split(',')[0].trim() : gw.port.trim();
        
        const res = await testGsmConnection(portName, baudRate);
        if (res.ok) {
          updateGateway(id, 'status', 'ok');
          localStorage.setItem('systemReady', 'true');
        } else {
          updateGateway(id, 'status', 'error');
          localStorage.removeItem('systemReady');
        }
      } catch (error) {
        console.error('Lỗi kết nối GSM Backend:', error);
        updateGateway(id, 'status', 'error');
        localStorage.removeItem('systemReady');
      }
      return;
    }

    try {
      // Try to use the configured Python API URL from AI Settings if possible, 
      // but here we'll use a standard local path relative to the gateway IP if it's a web-based SIP server.
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${gw.ip}:${gw.port}/status`, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);

      if (response && response.ok) {
        updateGateway(id, 'status', 'ok');
        localStorage.setItem('systemReady', 'true');
      } else {
        updateGateway(id, 'status', 'error');
        localStorage.removeItem('systemReady');
      }
    } catch (error) {
      updateGateway(id, 'status', 'error');
      localStorage.removeItem('systemReady');
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('autocall.system.gateways', JSON.stringify(gateways));
      
      // Remove simulate success, we strictly rely on testConnection
      if (gateways.length === 0) {
        localStorage.removeItem('systemReady');
      }
      
      alert('Đã lưu cấu hình Gateway');
    } catch (error) {
      console.error("Lỗi lưu cấu hình:", error);
      alert('Lỗi lưu cấu hình. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-zinc-500 gap-3">
        <Loader2 className="animate-spin text-violet-500" size={32} />
        <p className="text-sm font-medium">Đang tải cấu hình thiết bị…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-800">Cấu hình Hệ thống (Gateway)</h2>
          <p className="text-sm text-zinc-500 mt-1">Kết nối phần mềm với các thiết bị viễn thông (SIP Server, Tổng đài ảo, mạng GSM Gateway).</p>
        </div>
        <div className="flex gap-2">
            <button type="button" onClick={() => addGateway('SIP')} className="bg-white border border-zinc-200 hover:bg-zinc-50 text-violet-600 px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm">
              <Plus size={18} /> Thêm SIP Server
            </button>
            <button type="button" onClick={() => addGateway('GSM')} className="bg-white border border-zinc-200 hover:bg-zinc-50 text-orange-600 px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm">
              <Plus size={18} /> Thêm GSM Gateway
            </button>
        </div>
      </div>


      <div className="flex justify-end">
         <button 
           onClick={saveConfig} 
           disabled={isSaving}
           className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-md disabled:opacity-50"
         >
           {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
           {isSaving ? "Đang lưu..." : "Lưu tất cả cấu hình"}
         </button>
      </div>

      {gateways.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center flex flex-col items-center justify-center text-zinc-500 shadow-sm">
           <div className="size-20 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
              <Network className="text-zinc-300" size={40} />
           </div>
           <h3 className="text-xl font-semibold text-zinc-800 mb-2">Chưa có thiết bị kết nối nào</h3>
           <p className="text-sm max-w-md text-zinc-500 leading-relaxed">
             Vui lòng cấu hình SIP Trunk hoặc thêm phần cứng GSM Gateway để hệ thống có thể thực hiện cuộc gọi ra ngoài mạng viễn thông.
           </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {gateways.map(gw => (
            <div key={gw.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
               <div className="bg-zinc-50/50 border-b border-zinc-200 p-5 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${gw.type === 'SIP' ? 'bg-violet-100 text-violet-600' : 'bg-orange-100 text-orange-600'}`}>
                       {gw.type === 'SIP' ? <Network size={20} /> : <PhoneCall size={20} />}
                    </div>
                    <div>
                       <input 
                         type="text" 
                         value={gw.name} 
                         onChange={(e) => updateGateway(gw.id, 'name', e.target.value)}
                         className="bg-transparent border-none outline-none focus:ring-2 focus:ring-violet-500 rounded px-1 font-bold text-zinc-800"
                       />
                       <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">{gw.type} GATEWAY</span>
                          <span className={`size-1.5 rounded-full ${gw.status === 'ok' ? 'bg-emerald-500' : gw.status === 'error' ? 'bg-red-500' : 'bg-zinc-300'}`}></span>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => deleteGateway(gw.id)} className="text-red-700 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 size={20} />
                 </button>
               </div>
               
               <div className="p-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                        {gw.type === 'SIP' ? 'Địa chỉ IP / Domain' : 'Cổng kết nối'}
                     </label>
                     <input type="text" value={gw.ip} onChange={(e) => updateGateway(gw.id, 'ip', e.target.value)} placeholder={gw.type === 'SIP' ? "192.168.1.100" : "ví dụ: COM3"} className="w-full border border-zinc-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Port kết nối</label>
                     <input type="text" value={gw.port} onChange={(e) => updateGateway(gw.id, 'port', e.target.value)} placeholder={gw.type === 'SIP' ? "5060" : "115200 (Baud Rate)"} className="w-full border border-zinc-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-mono" />
                   </div>
                   
                   {gw.type === 'SIP' ? (
                     <div className="lg:col-span-1 grid grid-cols-1 gap-6">
                        <div className="space-y-1">
                           <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">SIP Username</label>
                           <input type="text" value={gw.username || ''} onChange={(e) => updateGateway(gw.id, 'username', e.target.value)} placeholder="autocall_ai" className="w-full border border-zinc-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
                        </div>
                     </div>
                   ) : gw.type === 'GSM' ? (
                     <div className="lg:col-span-1 space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Trạng thái Khe SIM</label>
                        <div className="grid grid-cols-4 gap-2">
                           {[1,2,3,4].map(i => (
                              <div key={`item-${i}`} className="flex flex-col items-center gap-1">
                                 <div className={`w-full h-8 rounded-lg flex items-center justify-center border ${gw.status === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-zinc-50 border-zinc-200 text-zinc-300'}`}>
                                    <PhoneCall size={12} />
                                 </div>
                                 <span className="text-[9px] font-bold text-zinc-400">Slot {i}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                   ) : (
                     <div className="lg:col-span-1 space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Thiết bị không xác định</label>
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">Cấu hình cũ, vui lòng xóa.</div>
                     </div>
                   )}

                   <div className="md:col-span-2 lg:col-span-3 pt-6 border-t border-zinc-100 flex items-center justify-between">
                     <button 
                       onClick={() => testConnection(gw.id)} 
                       disabled={gw.status === 'testing'} 
                       className="bg-violet-50 hover:bg-violet-100 text-violet-700 px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                     >
                       <Activity size={18} className={gw.status === 'testing' ? 'animate-spin' : ''} /> 
                       {gw.status === 'testing' ? 'Đang gọi kiểm tra...' : 'Test Connection'}
                     </button>
                     
                     <div className="flex items-center gap-3">
                        {gw.status === 'ok' && (
                           <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 animate-in fade-in zoom-in duration-300">
                              <ShieldCheck size={18} />
                              <span className="text-sm font-bold">Thiết bị Sẵn sàng</span>
                           </div>
                        )}
                        {gw.status === 'error' && (
                           <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                              <span className="text-sm font-bold">Lỗi Kết nối</span>
                           </div>
                        )}
                        {gw.status === 'idle' && (
                           <span className="text-xs font-bold text-zinc-400 italic">Chưa kiểm tra trạng thái</span>
                        )}
                     </div>
                   </div>

                 </div>
               </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
