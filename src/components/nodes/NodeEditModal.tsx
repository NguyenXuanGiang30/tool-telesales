/* oxlint-disable react-doctor/no-giant-component */
import React from 'react';
import { X, Save, Trash2, Volume2, Headphones, Zap, Plus, Play, Mic, Square, Sparkles } from 'lucide-react';
import { LazyMotion, m, AnimatePresence, domAnimation, useReducedMotion } from 'motion/react';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: any;
  onSave: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}

export default function NodeEditModal({ isOpen, onClose, node, onSave, onDelete }: NodeEditModalProps) {
  // All hooks must be called unconditionally before any early returns (Rules of Hooks)
  const shouldReduceMotion = useReducedMotion(); // WCAG 2.3.3
  const [localData, setLocalData] = React.useState<any>(node?.data ?? {});
  const [isRecording, setIsRecording] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);

  // Sync local state when node prop changes
  React.useEffect(() => {
    if (node?.data) setLocalData(node.data);
  }, [node?.id]);

  if (!node) return null;

  const handleSave = () => {
    onSave(node.id, localData);
    onClose();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setLocalData((prev: any) => ({ ...prev, audioUrl: url, aiEnhanced: true }));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const nodeLabel = () => {
    switch (node.type) {
      case 'botSpeak': return node.data.isRetry ? 'Cấu hình Bot Nói Lại' : 'Cấu hình Bot Nói';
      case 'botListen': return 'Cấu hình Bot Nghe';
      case 'botAction': return 'Cấu hình Hành Động';
      default: return 'Cấu hình Thẻ';
    }
  };

  const getIcon = () => {
    switch (node.type) {
      case 'botSpeak': return <Volume2 className="text-green-500" />;
      case 'botListen': return <Headphones className="text-green-500" />;
      case 'botAction': return <Zap className="text-amber-500" />;
      default: return <Save />;
    }
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <m.div
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <m.div
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative border border-zinc-200"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-zinc-200">
                    {getIcon()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">{nodeLabel()}</h3>
                    <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Node ID: {node.id}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">

                {/* Type specific fields */}
                {node.type === 'botSpeak' && (
                  <div className="space-y-4">
                    <div className="flex gap-4 mb-4">
                      <label htmlFor="edit-audio-tts" className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                        <input id="edit-audio-tts" type="radio" name="editaudiotype" className="accent-green-500" defaultChecked={!localData.audioUrl} onClick={() => setLocalData((prev: any) => ({ ...prev, audioUrl: null }))} />
                        Giọng máy (AI TTS)
                      </label>
                      <label htmlFor="edit-audio-record" className="flex items-center gap-2 text-sm text-zinc-700 font-medium cursor-pointer">
                        <input id="edit-audio-record" type="radio" name="editaudiotype" className="accent-green-500" defaultChecked={!!localData.audioUrl} onClick={() => setLocalData((prev: any) => ({ ...prev, audioUrl: prev.audioUrl || '' }))} />
                        Giọng thu âm
                      </label>
                    </div>
                    {(!localData.audioUrl && localData.audioUrl !== '') ? (
                      <>
                        <div>
                          <label htmlFor="edit-bot-text" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Nội dung Bot nói</label>
                          <div className="relative">
                            <textarea
                              id="edit-bot-text"
                              value={localData.text || ''}
                              onChange={e => setLocalData((prev: any) => ({ ...prev, text: e.target.value }))}
                              className="w-full border border-zinc-200 rounded-xl p-4 pb-12 text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-zinc-50/30 resize-none"
                              placeholder="Chào anh chị, em là Callbot từ…"
                            />
                            <button
                              onClick={() => {
                                if (!localData.text) return;
                                const synth = window.speechSynthesis;
                                synth.cancel();
                                const u = new SpeechSynthesisUtterance(localData.text);
                                u.lang = 'vi-VN';
                                const voices = synth.getVoices();
                                const vnVoice = voices.find(v => v.lang.includes('vi'));
                                if (vnVoice) u.voice = vnVoice;
                                synth.speak(u);
                              }}
                              className="absolute bottom-3 right-3 bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1.5 flex items-center gap-1.5 text-[11px] uppercase font-bold rounded-lg transition-colors border border-violet-100"
                              title="Nghe thử giọng giọng đọc"
                            >
                              <Play size={12} fill="currentColor" /> Nghe thử
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="edit-speed" className="block text-xs font-bold text-zinc-500 uppercase">Tốc độ nói (AI)</label>
                            <select id="edit-speed" className="w-full border border-zinc-200 rounded-lg p-2 text-sm outline-none">
                              <option>Bình thường (1.0x)</option>
                              <option>Chậm (0.8x)</option>
                              <option>Nhanh (1.2x)</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="edit-voice" className="block text-xs font-bold text-zinc-500 uppercase">Giọng đọc</label>
                            <select id="edit-voice" className="w-full border border-zinc-200 rounded-lg p-2 text-sm outline-none">
                              <option>Nữ Miền Nam</option>
                              <option>Nam Miền Bắc</option>
                            </select>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div>
                        <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                          File Ghi Âm
                          {localData.audioUrl && (
                            <button
                              onClick={() => setLocalData((prev: any) => ({ ...prev, audioUrl: '' }))}
                              className="text-red-500 hover:text-red-600 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1 normal-case tracking-normal"
                            >
                              <Trash2 size={12} /> Xóa audio
                            </button>
                          )}
                        </span>

                        {localData.audioUrl && localData.audioUrl !== '' ? (
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                            <audio controls className="w-full h-10 mb-4 rounded-lg">
                              <source src={localData.audioUrl} type="audio/webm" />
                              <source src={localData.audioUrl} type="audio/mpeg" />
                            </audio>

                            <div className="bg-white border text-sm border-zinc-200 rounded-lg p-3 flex flex-col gap-3">
                              <label htmlFor="edit-ai-enhance" className="flex items-center gap-2 text-zinc-700 font-medium cursor-pointer">
                                <input
                                  id="edit-ai-enhance"
                                  type="checkbox"
                                  className="accent-violet-600 size-4"
                                  checked={localData.aiEnhanced}
                                  onChange={e => setLocalData((prev: any) => ({ ...prev, aiEnhanced: e.target.checked }))}
                                />
                                <Sparkles className="text-violet-500" size={16} />
                                Kích hoạt Khử ồn AI (Studio Sound)
                              </label>
                              <p className="text-xs text-zinc-500 pl-6 leading-relaxed">
                                AI sẽ tự động phân tích tần số, loại bỏ tạp âm môi trường và chuẩn hóa âm lượng để giọng nói rõ ràng hơn khi gọi điện thoại.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <label htmlFor="edit-upload-audio" className="bg-violet-50 hover:bg-violet-100 text-violet-700 font-medium text-sm py-6 rounded-xl transition-colors cursor-pointer text-center border-2 border-dashed border-violet-200 flex flex-col items-center justify-center gap-3 group">
                              <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                <Volume2 size={24} className="text-violet-500" />
                              </div>
                              <div className="flex flex-col items-center">
                                <span>Tải lên audio</span>
                                <span className="text-xs text-violet-500/80 font-normal mt-1">(Hỗ trợ MP3, WAV)</span>
                              </div>
                              <input id="edit-upload-audio" type="file" accept="audio/*" className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const url = URL.createObjectURL(e.target.files[0]);
                                    setLocalData((prev: any) => ({ ...prev, audioUrl: url, aiEnhanced: true }));
                                  }
                                }}
                              />
                            </label>

                            {isRecording ? (
                              <button
                                onClick={stopRecording}
                                className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-medium text-sm py-6 rounded-xl transition-colors text-center flex flex-col items-center justify-center gap-3 animate-pulse"
                              >
                                <div className="p-3 bg-red-600 rounded-full shadow-sm">
                                  <Square size={24} className="text-white" fill="currentColor" />
                                </div>
                                <div className="flex flex-col items-center">
                                  <span>Đang thu âm…</span>
                                  <span className="text-xs text-red-500/80 font-normal mt-1">Bấm để dừng</span>
                                </div>
                              </button>
                            ) : (
                              <button
                                onClick={startRecording}
                                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-medium text-sm py-6 rounded-xl transition-colors text-center flex flex-col items-center justify-center gap-3 group"
                              >
                                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                  <Mic size={24} className="text-emerald-500" />
                                </div>
                                <div className="flex flex-col items-center">
                                  <span>Thu âm trực tiếp</span>
                                  <span className="text-xs text-emerald-600/80 font-normal mt-1">Sử dụng Micro thiết bị</span>
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {node.type === 'botListen' && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit-intent-name" className="block text-xs font-bold text-violet-500 uppercase mb-2 flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                        Tên nhóm ý định (AI Intent)
                      </label>
                      <input
                        id="edit-intent-name"
                        type="text"
                        value={localData.intentName || ''}
                        onChange={e => setLocalData((prev: any) => ({ ...prev, intentName: e.target.value }))}
                        className="w-full border border-violet-200 bg-violet-50/30 rounded-lg p-2.5 text-sm outline-none focus:border-violet-500 font-medium"
                        placeholder="vd: Khách hàng đồng ý, Khách hàng bận…"
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-zinc-500 uppercase mb-2">Prompt miêu tả ý định (Phân cách bằng dấu phẩy)</span>
                      <div className="space-y-3">
                        {localData.branches?.map((branch: any, idx: number) => (
                          <div key={branch.id ?? `branch-${idx}`} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 relative group flex gap-2 items-start">
                            <textarea
                              defaultValue={branch.keywords.join(', ')}
                              className="w-full bg-white border border-zinc-200 rounded text-sm outline-none p-2 min-h-[60px] resize-none"
                              placeholder="vd: người dùng nói là đang bận cần gọi lại sau, người dùng muốn gửi thông tin qua zalo…"
                            />
                            <button className="text-zinc-400 hover:text-red-500 p-1">
                              <Trash2 size={16} />
                            </button>
                            <div className="absolute -top-2 left-2 text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded shadow-sm border border-violet-200 font-semibold">Luồng phản hồi #{idx + 1}</div>
                          </div>
                        ))}
                        <button className="w-full py-2 border-2 border-dashed border-violet-200 rounded-xl text-violet-500 text-xs flex items-center justify-center gap-2 hover:bg-violet-50 transition-colors font-medium">
                          <Plus size={14} /> Thêm nhánh ý định (LLM Branch)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {node.type === 'botAction' && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit-action-type" className="block text-xs font-bold text-zinc-500 uppercase mb-2">Loại hành động</label>
                      <select
                        id="edit-action-type"
                        value={localData.actionType}
                        onChange={e => setLocalData((prev: any) => ({ ...prev, actionType: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-lg p-2.5 text-sm outline-none"
                      >
                        <option value="label">Gắn nhãn (Tag)</option>
                        <option value="transfer">Chuyển máy (Transfer)</option>
                        <option value="notify">Thông báo (Webhook)</option>
                        <option value="trigger">Kích hoạt (Trigger)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit-action-value" className="block text-xs font-bold text-zinc-500 uppercase mb-2">Giá trị hành động</label>
                      <input
                        id="edit-action-value"
                        type="text"
                        value={localData.text || ''}
                        onChange={e => setLocalData((prev: any) => ({ ...prev, text: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-lg p-2.5 text-sm outline-none focus:border-amber-500 bg-zinc-50/50"
                        placeholder="Nhập giá trị…"
                      />
                    </div>
                  </div>
                )}

                {/* Shared Settings */}
                <div className="pt-6 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-semibold text-zinc-800 uppercase tracking-wide">Cài đặt nâng cao</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-4 bg-zinc-200 rounded-full relative cursor-pointer">
                        <div className="size-3 bg-white rounded-full absolute top-0.5 left-1 shadow-sm"></div>
                      </div>
                      <span className="text-[10px] text-zinc-400">Chế độ AI thông minh</span>
                    </div>
                  </div>
                  <div className="p-4 bg-violet-50/30 rounded-xl border border-violet-100/50">
                    <p className="text-[11px] text-violet-600/70 leading-relaxed italic">
                      Dữ liệu từ thẻ này sẽ được AI phân tích để đưa ra quyết định chuyển thẻ tiếp theo dựa trên "Xác suất hội thoại".
                    </p>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <button
                  onClick={() => {
                    onDelete(node.id);
                    onClose();
                  }}
                  className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                >
                  <Trash2 size={16} /> Xóa thẻ
                </button>
                <div className="flex gap-3">
                  <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all">Hủy</button>
                  <button onClick={handleSave} className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-violet-200 transition-all flex items-center gap-2">
                    <Save size={16} /> Lưu cấu hình
                  </button>
                </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
