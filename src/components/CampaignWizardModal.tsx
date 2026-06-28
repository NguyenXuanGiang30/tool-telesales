/* eslint-disable */
/* oxlint-disable react-doctor/prefer-useReducer, react-doctor/no-giant-component */
import React, { useState, useRef } from 'react';
import { X, Check, Inbox, Download, Plus, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { importContacts } from '../lib/api';

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
}

export default function CampaignWizardModal({ isOpen, onClose, campaignId }: CampaignWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(2); // Start at step 2 after saving flow
  const [activeTab, setActiveTab] = useState('file');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [filterDuplicates, setFilterDuplicates] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const downloadSampleTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Số điện thoại": "0987654321", "Họ tên": "Nguyễn Văn A", "Email": "a@gmail.com", "Nguồn": "Facebook" },
      { "Số điện thoại": "0912345678", "Họ tên": "Trần Thị B", "Email": "b@gmail.com", "Nguồn": "Zalo" }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Khách hàng");
    XLSX.writeFile(wb, "Mau_Danh_Sach_Khach_Hang.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onerror = () => {
      alert("Lỗi khi đọc file.");
    };
    reader.onload = (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        if (!dataBuffer) throw new Error("No data buffer");
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length > 0) {
          const firstRow = data[0] as any;
          const phoneKey = Object.keys(firstRow).find(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('thoại') || k.toLowerCase().includes('sdt') || k.toLowerCase().includes('sđt'));
          
          if (!phoneKey) {
            alert('Lỗi: File Excel thiếu cột "Số điện thoại" (hoặc SĐT). Vui lòng thêm cột này để tiếp tục.');
            setFile(null);
            setParsedData([]);
            return;
          }
        } else {
          alert('Lỗi: File Excel không có dữ liệu.');
          setFile(null);
          setParsedData([]);
          return;
        }

        setParsedData(data);
      } catch (err) {
        console.error("Parse error:", err);
        alert("Không thể đọc file Excel này.");
        setFile(null);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      processFile(droppedFile);
    } else {
      alert("Chỉ hỗ trợ định dạng .xlsx");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleImportToDatabase = async () => {
    if (parsedData.length === 0) {
      setCurrentStep(3);
      return;
    }
    
    setIsProcessing(true);
    try {
      const normalizeKey = (key: string) =>
        key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const contacts = parsedData.map((row: any) => {
        const phoneKey = Object.keys(row).find(k => {
          const normalized = normalizeKey(k);
          return normalized.includes('phone') || normalized.includes('thoai') || normalized.includes('sdt');
        });
        const nameKey = Object.keys(row).find(k => {
          const normalized = normalizeKey(k);
          return normalized.includes('name') || normalized.includes('ten');
        });
        const emailKey = Object.keys(row).find(k => normalizeKey(k).includes('email'));
        const sourceKey = Object.keys(row).find(k => {
          const normalized = normalizeKey(k);
          return normalized.includes('nguon') || normalized.includes('source');
        });

        return {
          campaign_id: campaignId,
          name: nameKey ? row[nameKey] : 'Khách hàng ẩn danh',
          phone: phoneKey ? row[phoneKey].toString() : '',
          email: emailKey ? row[emailKey] : '',
          source: sourceKey ? row[sourceKey] : 'Import File',
          tags: ['Chiến dịch mới'],
          last_call: '-',
          status: 'pending',
        };
      });

      const rowsToImport = filterDuplicates
        ? Array.from(new Map(contacts.map(contact => [contact.phone, contact])).values())
        : contacts;

      await importContacts(rowsToImport);
      alert(`Đã hoàn tất nhập ${rowsToImport.length} khách hàng!`);
      // Chuyển sang bước 3 (Cài đặt khác)
      setCurrentStep(3);
    } catch (error) {
      console.error("Lỗi import file:", error);
      alert("Đã xảy ra lỗi khi thêm dữ liệu.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[90vh] md:h-[80vh]">
        {/* Header - Stepper */}
        <div className="relative border-b border-zinc-100 px-8 py-5 shrink-0 bg-white shadow-[0_4px_20px_-15px_rgba(0,0,0,0.1)] z-10">
          <button onClick={onClose} className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 transition-colors p-1">
            <X size={20} />
          </button>
          
          <div className="flex items-start justify-between relative max-w-4xl mx-auto pt-2">
            {/* Connecting lines */}
            <div className="absolute top-4 left-[10%] right-[10%] h-[1px] bg-zinc-200 -z-10"></div>
            
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-2 relative bg-white px-2">
              <div className="size-8 rounded-full border-2 border-red-500 text-red-500 bg-white flex items-center justify-center text-sm font-medium">
                <Check size={16} strokeWidth={3} />
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-red-500 uppercase">Bước 1</div>
                <div className="text-[13px] text-zinc-500 mt-0.5">Chọn kịch bản</div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-2 relative bg-white px-2">
              <div className={`size-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= 2 ? 'border-red-500 text-red-500' : 'border-zinc-300 text-zinc-400'}`}>
                {currentStep > 2 ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
              </div>
              <div className="text-center">
                <div className={`text-xs font-semibold uppercase ${currentStep >= 2 ? 'text-red-500' : 'text-zinc-400'}`}>Bước 2</div>
                <div className={`text-[13px] mt-0.5 ${currentStep >= 2 ? 'text-zinc-700 font-medium' : 'text-zinc-500'}`}>Nhập danh sách<br/>khách hàng</div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-2 relative bg-white px-2">
              <div className={`size-8 rounded-full border flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= 3 ? 'border-red-500 text-red-500' : 'border-zinc-300 text-zinc-400 bg-zinc-50'}`}>
                3
              </div>
              <div className="text-center">
                <div className={`text-xs font-semibold uppercase ${currentStep >= 3 ? 'text-red-500' : 'text-zinc-400'}`}>Bước 3</div>
                <div className={`text-[13px] mt-0.5 ${currentStep >= 3 ? 'text-zinc-700' : 'text-zinc-400'}`}>Cài đặt khác</div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center gap-2 relative bg-white px-2">
              <div className={`size-8 rounded-full border flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= 4 ? 'border-red-500 text-red-500' : 'border-zinc-300 text-zinc-400 bg-zinc-50'}`}>
                4
              </div>
              <div className="text-center">
                <div className={`text-xs font-semibold uppercase ${currentStep >= 4 ? 'text-red-500' : 'text-zinc-400'}`}>Bước 4</div>
                <div className={`text-[13px] mt-0.5 ${currentStep >= 4 ? 'text-zinc-700' : 'text-zinc-400'}`}>Chạy chiến dịch</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-zinc-50 p-8">
          
          {currentStep === 2 && (
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-base font-semibold text-zinc-800">Bạn muốn nhập danh sách khách hàng từ nguồn nào?</h2>
              
              {/* Tabs */}
              <div className="flex w-full rounded-md border border-zinc-200 bg-zinc-100 p-1">
                <button 
                  onClick={() => setActiveTab('file')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded shadow-sm text-center transition-all ${activeTab === 'file' ? 'bg-white text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Nhập từ file
                </button>
                <button 
                  onClick={() => setActiveTab('group')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded text-center transition-all ${activeTab === 'group' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Nhập từ nhóm khách hàng
                </button>
                <button 
                  onClick={() => setActiveTab('campaign')}
                  className={`flex-1 py-2.5 text-sm font-medium rounded text-center transition-all ${activeTab === 'campaign' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Nhập từ chiến dịch khác
                </button>
              </div>

              {activeTab === 'file' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <button onClick={downloadSampleTemplate} className="text-sm text-violet-600 hover:text-violet-800 text-left flex items-center gap-1.5 focus:outline-none">
                    <Download size={16} /> Tải file mẫu danh sách khách hàng
                  </button>

                  {/* Dropzone */}
                  <div 
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-zinc-300 rounded-lg bg-white p-12 text-center transition-colors hover:bg-zinc-50 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                    />
                    
                    {!file ? (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Inbox size={48} strokeWidth={1} className="text-violet-600/80" />
                        <div className="text-zinc-700">Click hoặc kéo thả file vào đây để upload</div>
                        <div className="text-xs text-zinc-400">Chỉ hỗ trợ 1 file / 1 lần. Định dạng .xlsx (Microsoft Excel)</div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
                          <Check size={32} />
                        </div>
                        <div className="text-zinc-800 font-medium">Đã tải lên: {file.name}</div>
                        <div className="text-xs text-zinc-500">Phát hiện {parsedData.length} khách hàng</div>
                        <button 
                           onClick={(e) => { e.stopPropagation(); setFile(null); setParsedData([]); }}
                           className="text-sm text-red-500 mt-2 hover:underline"
                        >
                           Xóa file và tải lại
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Checkboxes */}
                  <div className="flex items-center justify-center gap-8 py-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500 size-4 cursor-pointer"
                        checked={overwrite}
                        onChange={(e) => setOverwrite(e.target.checked)}
                      /> 
                      Ghi đè lên danh sách hiện tại
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500 size-4 cursor-pointer"
                        checked={filterDuplicates}
                        onChange={(e) => setFilterDuplicates(e.target.checked)}
                      /> 
                      Lọc số điện thoại trùng lặp
                    </label>
                  </div>

                  {/* Action Button */}
                  <div className="flex justify-center pt-2">
                    <button 
                      onClick={handleImportToDatabase}
                      disabled={isProcessing}
                      className="bg-zinc-100 text-zinc-500 border border-zinc-200 px-6 py-2.5 rounded text-sm font-medium transition-all hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2 data-[active=true]:bg-violet-600 data-[active=true]:text-white data-[active=true]:border-violet-600"
                      data-active={true}
                    >
                      {isProcessing ? (
                        <><RefreshCw size={18} className="animate-spin" /> Đang xử lý…</>
                      ) : (
                        <><Plus size={18} /> Thêm vào danh sách khách hàng</>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {activeTab === 'group' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-white border text-left border-zinc-200 rounded-lg p-6">
                     <p className="text-sm text-zinc-500 mb-4">Các nhóm khách hàng trích xuất tự động từ Nhãn (Tags) của hệ thống CRM:</p>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors border-violet-200 bg-violet-50/50">
                           <input type="radio" name="crm_group" className="mt-1" defaultChecked />
                           <div>
                              <div className="font-semibold text-zinc-800 text-sm">Khách quan tâm mới</div>
                              <div className="text-xs text-zinc-500 mt-1">2,450 liên hệ</div>
                           </div>
                        </label>
                        <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors">
                           <input type="radio" name="crm_group" className="mt-1" />
                           <div>
                              <div className="font-semibold text-zinc-800 text-sm">Sale Failed (Tháng trước)</div>
                              <div className="text-xs text-zinc-500 mt-1">843 liên hệ</div>
                           </div>
                        </label>
                        <label className="flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors">
                           <input type="radio" name="crm_group" className="mt-1" />
                           <div>
                              <div className="font-semibold text-zinc-800 text-sm">Kích hoạt tái ký</div>
                              <div className="text-xs text-zinc-500 mt-1">1,200 liên hệ</div>
                           </div>
                        </label>
                     </div>
                  </div>
                  <div className="flex justify-center pt-2">
                    <button 
                      onClick={() => { setParsedData(new Array(2450).fill({})); setCurrentStep(3); }}
                      className="bg-violet-600 text-white px-6 py-2.5 rounded text-sm font-medium transition-all hover:bg-violet-700 flex items-center gap-2"
                    >
                      <Plus size={18} /> Thêm vào chiến dịch
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'campaign' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-white border text-left border-zinc-200 rounded-lg p-6">
                     <p className="text-sm text-zinc-500 mb-4">Các chiến dịch Callbot gần đây của hệ thống:</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center justify-between p-4 border rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors border-violet-200 bg-violet-50/50">
                           <div className="flex items-center gap-3">
                             <input type="radio" name="prev_campaign" defaultChecked />
                             <div>
                                <div className="font-semibold text-zinc-800 text-sm">Campaign Tết Nguyên Đán 2026</div>
                                <div className="text-xs text-zinc-500 mt-1">Trạng thái: Hoàn thành</div>
                             </div>
                           </div>
                           <div className="text-right text-xs">
                             <span className="font-medium text-zinc-700">14,200</span> liên hệ
                           </div>
                        </label>
                        <label className="flex items-center justify-between p-4 border rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors">
                           <div className="flex items-center gap-3">
                             <input type="radio" name="prev_campaign" />
                             <div>
                                <div className="font-semibold text-zinc-800 text-sm">Tri ân sinh nhật T12/2025</div>
                                <div className="text-xs text-zinc-500 mt-1">Trạng thái: Đã dừng</div>
                             </div>
                           </div>
                           <div className="text-right text-xs">
                             <span className="font-medium text-zinc-700">850</span> liên hệ
                           </div>
                        </label>
                     </div>
                  </div>
                  <div className="flex justify-center pt-2">
                    <button 
                      onClick={() => { setParsedData(new Array(14200).fill({})); setCurrentStep(3); }}
                      className="bg-violet-600 text-white px-6 py-2.5 rounded text-sm font-medium transition-all hover:bg-violet-700 flex items-center gap-2"
                    >
                      <RefreshCw size={18} /> Kế thừa khách hàng
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center">
                <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Check size={32} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-semibold text-zinc-800">Đã nạp {parsedData.length} số liên hệ</h2>
                <p className="text-zinc-500 mt-2">Vui lòng cấu hình tham số phần cứng trước khi tiến hành quay số hàng loạt.</p>
              </div>
              
              <div className="bg-white border border-zinc-200 shadow-sm rounded-xl p-6 md:p-8 space-y-6 text-left">
                 <h3 className="text-lg font-semibold text-zinc-800 border-b border-zinc-100 pb-4">Cài đặt quy tắc gọi (Rules)</h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                       <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Khung giờ hoạt động</label>
                          <div className="flex items-center gap-2">
                             <input type="time" defaultValue="08:00" className="flex-1 border border-zinc-300 rounded-lg p-2 text-sm outline-none focus:border-violet-500" />
                             <span className="text-zinc-500">-</span>
                             <input type="time" defaultValue="17:00" className="flex-1 border border-zinc-300 rounded-lg p-2 text-sm outline-none focus:border-violet-500" />
                          </div>
                          <p className="text-xs text-zinc-500 mt-1.5">Callbot sẽ tự động tạm dừng ngoài giờ này</p>
                       </div>
                       
                       <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Giới hạn gọi đồng thời (CC)</label>
                          <div className="relative">
                             <input type="number" defaultValue="1" min="1" max="100" className="w-full border border-zinc-300 rounded-lg p-2 text-sm outline-none focus:border-violet-500" />
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">cuộc gọi</span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                       <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Cơ chế gọi lại (Retry)</label>
                          <select className="w-full border border-zinc-300 rounded-lg p-2 text-sm outline-none focus:border-violet-500">
                             <option>Chỉ gọi 1 lần duy nhất</option>
                             <option defaultValue="true">Gọi lại nếu máy bận / Không nghe máy</option>
                             <option>Gọi tới khi nào bắt máy</option>
                          </select>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-3">
                          <div>
                             <label className="block text-xs font-medium text-zinc-500 mb-1">Số lần thử tối đa</label>
                             <input type="number" defaultValue="2" className="w-full border border-zinc-300 border-l-4 border-l-indigo-500 rounded-lg p-2 text-sm outline-none" />
                          </div>
                          <div>
                             <label className="block text-xs font-medium text-zinc-500 mb-1">Khoảng cách</label>
                             <div className="relative">
                               <input type="number" defaultValue="60" className="w-full border border-zinc-300 rounded-lg p-2 text-sm outline-none" />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">phút</span>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
              
              <div className="flex justify-center gap-4 pt-4">
                 <button onClick={() => setCurrentStep(2)} className="bg-white border border-zinc-300 text-zinc-600 px-8 py-3 rounded-xl font-medium hover:bg-zinc-50 transition shadow-sm">
                    Quay lại
                 </button>
                 <button onClick={() => setCurrentStep(4)} className="bg-violet-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-violet-700 transition shadow-lg shadow-violet-600/20 flex items-center gap-2">
                    Bắt đầu chạy chiến dịch ngay <Plus size={18} className="rotate-45" />
                 </button>
              </div>
            </div>
          )}
          
          {currentStep === 4 && (
            <div className="max-w-md mx-auto mt-10 p-8 bg-white border border-zinc-100 shadow-2xl rounded-2xl text-center animate-in fade-in slide-in-from-bottom-8 duration-500">
                  <div className="relative size-24 mx-auto mb-8">
                     <div className="absolute inset-0 bg-violet-100 rounded-full animate-ping opacity-75"></div>
                     <div className="absolute inset-0 bg-violet-50 rounded-full animate-pulse"></div>
                     <div className="relative size-full bg-white border-4 border-violet-600 rounded-full flex items-center justify-center text-violet-600 shadow-lg shadow-violet-600/30">
                        <RefreshCw size={36} strokeWidth={2.5} className="animate-spin" />
                     </div>
                  </div>
                  
                  <h2 className="text-2xl font-semibold text-zinc-800 mb-3 tracking-tight">Đang mồi hệ thống AI…</h2>
                  <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                    Chiến dịch <strong>{parsedData.length} liên hệ</strong> đang được đẩy vào hàng đợi.<br/>
                    AI Callbot nội bộ sẽ sớm kích hoạt cuộc gọi đầu tiên theo cấu hình của bạn.
                  </p>
                  
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-8">
                    <div className="bg-violet-600 h-full rounded-full w-2/3 animate-[pulse_2s_ease-in-out_infinite] transition-all duration-1000 relative">
                       <div className="absolute inset-0 bg-white/20 size-full animate-[translateX_1s_infinite]"></div>
                    </div>
                  </div>
                  
                  <button onClick={() => { onClose(); window.location.hash = 'sales'; }} className="w-full bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-violet-600 hover:border-violet-200 px-6 py-3 rounded-xl font-semibold transition-all">
                     Đóng & Chuyển tới Telesale Workspace
                  </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
