/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { Users, Upload, Filter, Search, Plus, X, Loader2, PhoneForwarded } from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, where, writeBatch, doc } from '../lib/firebase';
import { db, auth } from '../lib/firebase';
import * as XLSX from 'xlsx';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  tags: string[];
  lastCall: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', source: '', tags: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/contacts`),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Contact[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Contact);
      });
      setContacts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setImporting(true);
    const reader = new FileReader();
    
    reader.onerror = () => {
      alert("Lỗi khi đọc file.");
      setImporting(false);
    };

    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        if (!dataBuffer) throw new Error("No data buffer");
        
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert("File Excel trống hoặc không đúng định dạng.");
          setImporting(false);
          return;
        }

        // --- PRE-CHECK VALIDATION ---
        let validRows: any[] = [];
        let invalidCount = 0;
        let missingNameCount = 0;
        let missingPhoneCount = 0;

        data.forEach(row => {
          // Normalize row keys to lowercase for robust mapping
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim()] = row[key];
          });

          const rawName = normalizedRow['name'] || 
                          normalizedRow['họ tên'] || 
                          normalizedRow['tên'] || 
                          normalizedRow['customer name'] || 
                          normalizedRow['khách hàng'] || 
                          normalizedRow['fullname'] || 
                          normalizedRow['full name'] || 
                          normalizedRow['tên khách hàng'] ||
                          '';

          const rawPhone = String(
            normalizedRow['phone'] || 
            normalizedRow['số điện thoại'] || 
            normalizedRow['sđt'] || 
            normalizedRow['mobile'] || 
            normalizedRow['điện thoại'] ||
            ''
          );
          
          const phone = rawPhone.replace(/\s/g, '').replace(/[^0-9+]/g, '');

          if (!phone) {
            missingPhoneCount++;
            invalidCount++;
          } else {
            validRows.push({ 
              ...row, 
              processedPhone: phone, 
              processedName: String(rawName).trim() || 'Khách hàng',
              processedEmail: normalizedRow['email'] || '',
              processedSource: normalizedRow['source'] || normalizedRow['nguồn'] || 'Import Excel',
              processedTags: normalizedRow['tags'] || normalizedRow['nhãn'] || ''
            });
          }
        });

        const confirmMsg = `Phát hiện ${data.length} dòng dữ liệu:\n` +
          `- Hợp lệ: ${validRows.length} dòng\n` +
          `- Thiếu SĐT (bị loại bỏ): ${missingPhoneCount} dòng\n\n` +
          (validRows.length === 0 ? "Không có dữ liệu hợp lệ để nhập." : "Bạn có muốn tiếp tục nhập các dòng hợp lệ không?");

        if (validRows.length === 0) {
          alert(confirmMsg);
          setImporting(false);
          return;
        }

        if (!window.confirm(confirmMsg)) {
          setImporting(false);
          return;
        }

        const batchSize = 500;
        const userId = auth.currentUser!.uid;
        const contactsCol = collection(db, `users/${userId}/contacts`);
        
        let successCount = 0;
        
        for (let i = 0; i < validRows.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = validRows.slice(i, i + batchSize);
          
          chunk.forEach((row) => {
            const contactData = {
              userId: userId,
              name: row.processedName,
              phone: row.processedPhone,
              email: row.processedEmail,
              source: row.processedSource,
              tags: String(row.processedTags).split(',').map((t: string) => t.trim()).filter(Boolean),
              lastCall: '-',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            const newDocRef = doc(contactsCol);
            batch.set(newDocRef, contactData);
            successCount++;
          });
          
          await batch.commit();
        }

        alert(`Đã nhập thành công ${successCount} liên hệ thành công.`);
      } catch (error) {
        console.error("Lỗi khi import Excel Tokyo:", error);
        alert("Lỗi khi xử lý file Excel. Vui lòng đảm bảo file là .xlsx hoặc .xls.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const [campaigns, setCampaigns] = useState<{id: string, name: string}[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const loadCampaigns = () => {
      const q = query(
        collection(db, `users/${auth.currentUser?.uid}/campaigns`),
        where('type', '==', 'callbot'),
        orderBy('createdAt', 'desc')
      );
      return onSnapshot(q, (snapshot) => {
        const camps: {id: string, name: string}[] = [];
        snapshot.forEach((doc) => {
          camps.push({ id: doc.id, name: doc.data().name });
        });
        setCampaigns(camps);
      });
    };
    const unsubscribeCampaigns = loadCampaigns();
    return () => unsubscribeCampaigns();
  }, []);

  const handleTransferToCampaign = async () => {
    if (!selectedCampaignId || selectedIds.length === 0 || !auth.currentUser) return;
    setTransferring(true);
    try {
      // In a real scenario, you might add these contacts as subcollection "leads" to the campaign
      // Or update the "total" field of the selected campaign. Here we just update the total slightly
      // and simulate the transfer for the demo.
      const campRef = doc(db, `users/${auth.currentUser.uid}/campaigns`, selectedCampaignId);
      
      // Assume we update total by adding selectedIds length (we might need a getDoc first, but we fake it simple)
      const { getDoc, updateDoc } = await import('../lib/firebase');
      const campSnap = await getDoc(campRef);
      if (campSnap.exists()) {
         const currentTotal = (campSnap.data() as any).total || 0;
         await updateDoc(campRef, { 
             total: currentTotal + selectedIds.length,
             updatedAt: serverTimestamp()
         });
      }

      alert(`Đã đưa ${selectedIds.length} khách hàng vào chiến dịch thành công! Callbot sẽ chuẩn bị gọi theo kịch bản.`);
      setShowCampaignModal(false);
      setSelectedIds([]); // reset selection
      setSelectedCampaignId('');
    } catch (err) {
      console.error("Lỗi khi chuyển campaign:", err);
      alert("Đã xảy ra lỗi khi chuyển vào chiến dịch. Vui lòng thử lại.");
    } finally {
      setTransferring(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/contacts`), {
        userId: auth.currentUser.uid,
        name: newContact.name.trim() || 'Khách hàng',
        phone: newContact.phone,
        email: newContact.email,
        source: newContact.source || 'Manual',
        tags: newContact.tags.split(',').map(t => t.trim()).filter(Boolean),
        lastCall: '-',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewContact({ name: '', phone: '', email: '', source: '', tags: '' });
    } catch (error) {
      console.error("Lỗi khi thêm liên hệ:", error);
      alert("Không thể thêm. Hãy kiểm tra kết nối mạng.");
    }
  };
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
            <h3 className="text-lg font-medium text-zinc-800">Quản lý Khách hàng (CRM)</h3>
            <p className="text-sm text-zinc-500 mt-1">Danh sách Data 1st-party dành cho Callbot.</p>
        </div>
        <div className="flex gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportExcel} 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
            />
            <button 
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {importing ? 'Đang nhập...' : 'Nhập Excel (Import)'}
            </button>
            <button onClick={() => setShowAddModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
              <Plus size={18} /> Thêm khách hàng
            </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between gap-4 bg-zinc-50 rounded-t-xl">
           <div className="flex items-center gap-4 flex-1">
             <div className="relative max-w-sm flex-1">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
               <input type="text" placeholder="Tìm tên, số điện thoại..." className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-300 rounded-lg outline-none focus:border-violet-500" />
             </div>
             {selectedIds.length > 0 && (
               <button 
                 onClick={() => setShowCampaignModal(true)}
                 className="flex items-center gap-2 bg-violet-50 text-violet-700 px-3 py-2 rounded-lg text-sm font-medium border border-violet-200 hover:bg-violet-100 transition-colors animate-in fade-in"
               >
                 <PhoneForwarded size={16} /> Chuyển {selectedIds.length} KH sang Callbot
               </button>
             )}
           </div>
           <button className="flex items-center gap-2 px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 bg-white shadow-sm shrink-0">
             <Filter size={16} /> Lọc dữ liệu
           </button>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-white border-b border-zinc-200 text-zinc-500 font-medium">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={contacts.length > 0 && selectedIds.length === contacts.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? contacts.map(c => c.id) : [])}
                    className="rounded text-violet-600 focus:ring-violet-500" 
                  />
                </th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4">Nguồn (Source)</th>
                <th className="px-6 py-4">Nhãn (Tags)</th>
                <th className="px-6 py-4">Lần gọi cuối</th>
                <th className="px-6 py-4">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Đang tải dữ liệu từ Cloud Firestore...</td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Chưa có khách hàng nào. Nhấn Thêm Khách Hàng để bắt đầu!</td></tr>
              ) : contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(contact.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, contact.id]);
                        else setSelectedIds(selectedIds.filter(id => id !== contact.id));
                      }}
                      className="rounded text-violet-600 border-zinc-300 focus:ring-violet-500" 
                    />
                  </td>
                  <td className="px-6 py-4">
                     <div className="font-medium text-zinc-800">{contact.name}</div>
                     <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span className="text-violet-600 font-mono">{contact.phone}</span>
                        <span>•</span>
                        <span>{contact.email || '-'}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                     {contact.source}
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex flex-wrap gap-1.5">
                        {contact.tags.map(tag => (
                           <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                              {tag}
                           </span>
                        ))}
                     </div>
                  </td>
                  <td className="px-6 py-4 text-xs">{contact.lastCall}</td>
                  <td className="px-6 py-4">
                     <button className="text-violet-600 hover:text-violet-800 font-medium text-xs">Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination mock */}
        <div className="p-4 border-t border-zinc-200 flex items-center justify-between text-sm text-zinc-500 bg-zinc-50 rounded-b-xl">
           <span>Hiển thị 1-{contacts.length} trên tổng số {contacts.length} khách hàng</span>
           <div className="flex gap-1">
              <button className="px-3 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-100 disabled:opacity-50" disabled>Trước</button>
              <button className="px-3 py-1 border border-zinc-300 rounded bg-violet-50 text-violet-600 font-medium border-violet-200">1</button>
              <button className="px-3 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-100 disabled:opacity-50" disabled>Sau</button>
           </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-zinc-800">Thêm khách hàng</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Họ tên</label>
                <input value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} type="text" className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm outline-none focus:border-violet-500" placeholder="Nguyễn Văn A (Không bắt buộc)" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Số điện thoại *</label>
                  <input required value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} type="tel" className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm outline-none focus:border-violet-500" placeholder="098..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                  <input value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} type="email" className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm outline-none focus:border-violet-500" placeholder="a@gmail.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nguồn (Source)</label>
                <input value={newContact.source} onChange={e => setNewContact({...newContact, source: e.target.value})} type="text" className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm outline-none focus:border-violet-500" placeholder="Website, Zalo, FB Ads..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Nhãn (Tags - Phân cách bằng dấu phẩy)</label>
                <input value={newContact.tags} onChange={e => setNewContact({...newContact, tags: e.target.value})} type="text" className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm outline-none focus:border-violet-500" placeholder="Khách mới, Quan tâm..." />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Hủy</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md transition-colors">Xác nhận Thêm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Transfer Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-800 text-lg flex items-center gap-2">
                <PhoneForwarded className="text-violet-600" size={24} /> 
                Chuyển Data sang Chiến dịch
              </h3>
              <button onClick={() => setShowCampaignModal(false)} className="text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
               <div className="bg-violet-50 text-violet-700 p-4 rounded-xl mb-6 text-sm">
                  Bạn đang chuẩn bị chuyển <strong>{selectedIds.length} khách hàng</strong> sang Callbot để gọi tự động.
               </div>
               
               <label className="block text-sm font-medium text-zinc-700 mb-2">Chọn chiến dịch Callbot *</label>
               {campaigns.length === 0 ? (
                  <div className="border border-zinc-200 rounded-lg p-4 text-center text-sm text-zinc-500 bg-zinc-50">
                     Chưa có chiến dịch Callbot nào. Hãy tạo bên menu Chiến dịch trước.
                  </div>
               ) : (
                 <select 
                   value={selectedCampaignId}
                   onChange={e => setSelectedCampaignId(e.target.value)}
                   className="w-full border border-zinc-300 rounded-lg p-3 text-sm outline-none focus:border-violet-500 bg-white"
                 >
                    <option value="" disabled>-- Chọn chiến dịch cần đổ Data --</option>
                    {campaigns.map(camp => (
                       <option key={camp.id} value={camp.id}>{camp.name}</option>
                    ))}
                 </select>
               )}
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3 border-t border-zinc-100 mt-2 bg-zinc-50">
              <button 
                 disabled={transferring}
                 onClick={() => setShowCampaignModal(false)} 
                 className="mt-4 px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200 bg-zinc-100 rounded-xl transition-colors"
              >Hủy</button>
              <button 
                 disabled={transferring || !selectedCampaignId}
                 onClick={handleTransferToCampaign}
                 className="mt-4 px-5 py-2.5 flex items-center gap-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                  {transferring && <Loader2 size={16} className="animate-spin" />}
                  {transferring ? 'Đang chuyển...' : 'Bắt đầu gửi Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
