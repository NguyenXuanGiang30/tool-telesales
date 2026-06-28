import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Volume2, Play, AudioLines, Trash2, Maximize2, Mic, Square, Sparkles } from 'lucide-react';
import { useState, useRef } from 'react';

export default function BotSpeakNode({ id, data, selected }: any) {
  const [audioType, setAudioType] = useState('text'); // "audio" | "text"
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { setNodes } = useReactFlow();

  const handleDelete = () => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
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
        setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, audioUrl: url, aiEnhanced: true } } : n));
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

  return (
    <div className={`bg-white rounded-xl shadow-lg border-2 min-w-[320px] overflow-hidden ${selected ? 'border-green-500' : 'border-transparent'}`}>
      <Handle type="target" position={Position.Left} className="size-3 bg-white border-2 border-zinc-400" />
      
      {/* Header */}
      <div className="p-3 bg-white border-b border-zinc-100 flex items-center justify-between">
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
            <input 
              type="radio" 
              name={`audio_type_${data.id}`} 
              className="accent-green-500"
              checked={audioType === 'text'}
              onChange={() => setAudioType('text')}
            /> Giọng máy
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-700 font-medium cursor-pointer">
            <input 
              type="radio" 
              name={`audio_type_${data.id}`} 
              className="accent-green-500"
              checked={audioType === 'audio'}
              onChange={() => setAudioType('audio')}
            /> Giọng thu âm
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDelete} className="text-zinc-400 hover:text-red-500 transition-colors p-1" title="Xóa thẻ">
            <Trash2 size={16} />
          </button>
          <button className="text-zinc-400 hover:text-violet-500 transition-colors p-1" title="Chỉnh sửa chi tiết">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Title Tag */}
        <div className="flex items-center gap-2">
          <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded inline-flex items-center gap-1">
            <AudioLines size={14} /> Bot Nói
          </div>
          {data.isRetry && (
            <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded inline-flex items-center gap-1">
              <AudioLines size={14} /> Bot Nói Lại
            </div>
          )}
        </div>

        {audioType === 'text' ? (
          <>
            <div className="flex gap-2">
              <select className="flex-1 text-sm border border-zinc-200 rounded p-1.5 text-zinc-500 bg-zinc-50/50 outline-none focus:border-green-400 transition-colors">
                <option>Chọn thuộc tính</option>
                <option>AI Voice: Nữ Miền Nam</option>
                <option>AI Voice: Nam Miền Bắc</option>
              </select>
              <select 
                className="flex-1 text-sm border border-zinc-200 rounded p-1.5 text-zinc-500 bg-zinc-50/50 outline-none focus:border-green-400 transition-colors"
                defaultValue={data.speed || "1.0"}
              >
                <option value="0.75">Tốc độ: x0.75</option>
                <option value="1.0">Tốc độ: Normal</option>
                <option value="1.25">Tốc độ: x1.25</option>
                <option value="1.5">Tốc độ: x1.5</option>
              </select>
            </div>
            <div className="relative">
              <textarea 
                className="w-full text-sm border border-zinc-200 rounded p-2 text-zinc-700 bg-zinc-50/50 min-h-[80px] outline-none focus:border-green-400 transition-colors resize-none pb-8"
                placeholder="Nhập câu nói để AI tạo giọng sinh động…"
                value={data.text || ''}
                onChange={(e) => setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, text: e.target.value } } : n))}
              ></textarea>
              <div className="absolute bottom-2 right-2 flex gap-2 items-center">
                <button 
                  onClick={() => {
                     if (!data.text) return;
                     const synth = window.speechSynthesis;
                     synth.cancel();
                     const u = new SpeechSynthesisUtterance(data.text);
                     u.lang = 'vi-VN';
                     const voices = synth.getVoices();
                     const vnVoice = voices.find(v => v.lang.includes('vi'));
                     if (vnVoice) u.voice = vnVoice;
                     synth.speak(u);
                  }}
                  className="bg-violet-50 text-violet-600 px-2 py-1 flex items-center gap-1 text-[10px] uppercase font-bold rounded hover:bg-violet-100 transition-colors"
                  title="Nghe thử giọng AI TTS"
                >
                  <Play size={10} fill="currentColor" /> Nghe thử
                </button>
                <Maximize2 size={14} className="text-zinc-400" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {data.audioUrl ? (
               <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 relative">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
                      <Volume2 size={14} /> Đoạn thu âm
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-violet-600 font-medium bg-violet-50 px-2 py-1 rounded cursor-pointer hover:bg-violet-100 transition-colors">
                      <input 
                        type="checkbox" 
                        defaultChecked={data.aiEnhanced}
                        onChange={(e) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, aiEnhanced: e.target.checked } } : n))}
                        className="accent-violet-600"
                      />
                      <Sparkles size={12} /> Khử ồn AI
                    </label>
                  </div>
                  <audio controls className="w-full h-8 mb-2">
                     <source src={data.audioUrl} type="audio/webm" />
                     <source src={data.audioUrl} type="audio/mpeg" />
                  </audio>
                  <div className="flex gap-2">
                    <label className="flex-1 bg-white hover:bg-zinc-100 text-zinc-600 font-medium text-xs py-1.5 rounded transition-colors cursor-pointer text-center border border-zinc-300 shadow-sm">
                      Upload tệp khác
                      <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                         if (e.target.files && e.target.files[0]) {
                             const url = URL.createObjectURL(e.target.files[0]);
                             setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, audioUrl: url } } : n));
                         }
                      }} />
                    </label>
                    <button 
                      onClick={() => setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, audioUrl: null } } : n))}
                      className="px-2 py-1.5 border border-red-200 text-red-500 rounded bg-white hover:bg-red-50 transition-colors flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
               </div>
            ) : (
               <div className="grid grid-cols-2 gap-2">
                  <label className="bg-violet-50 hover:bg-violet-100 text-violet-700 font-medium text-xs py-4 rounded-lg transition-colors cursor-pointer text-center border-2 border-dashed border-violet-200 flex flex-col items-center gap-2 group">
                    <div className="p-2 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform"><Volume2 size={18} /></div>
                    <span>Tải lên audio<br/><span className="text-[10px] font-normal opacity-80">(MP3, WAV)</span></span>
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                         if (e.target.files && e.target.files[0]) {
                             const url = URL.createObjectURL(e.target.files[0]);
                             setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, audioUrl: url, aiEnhanced: true } } : n));
                         }
                    }} />
                  </label>
                  
                  {isRecording ? (
                    <button 
                      onClick={stopRecording}
                      className="bg-red-50 hover:bg-red-100 text-red-600 font-medium text-xs py-4 rounded-lg transition-colors text-center border border-red-200 flex flex-col items-center justify-center gap-2 animate-pulse"
                    >
                      <div className="p-2 bg-red-600 text-white rounded-full"><Square size={16} fill="currentColor" /></div>
                      Dừng thu âm
                    </button>
                  ) : (
                    <button 
                      onClick={startRecording}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-xs py-4 rounded-lg transition-colors text-center border border-emerald-200 flex flex-col items-center justify-center gap-2 group"
                    >
                      <div className="p-2 bg-white text-emerald-600 rounded-full shadow-sm group-hover:scale-110 transition-transform"><Mic size={18} /></div>
                      Thu âm trực tiếp
                    </button>
                  )}
               </div>
            )}
            
            <div className="bg-violet-50/50 rounded p-2 flex items-start gap-2 border border-violet-100">
               <Sparkles className="text-violet-500 shrink-0 mt-0.5" size={12} />
               <p className="text-[10px] text-zinc-600">
                 Giọng thu âm của bạn sẽ được AI <strong className="text-violet-600">tự động khử tiếng ồn</strong>, chuẩn hóa âm lượng và loại bỏ khoảng lặng để chuyên nghiệp như thu ở studio.
               </p>
            </div>
          </div>
        )}

        {data.tip && (
          <div className="bg-orange-50 border border-orange-100 rounded p-2 text-xs flex flex-col gap-1 mt-1 relative">
            <div className="flex items-center gap-1 text-orange-500 font-medium tracking-wide">
               <span className="size-4 rounded-full bg-orange-400 text-white flex items-center justify-center text-[10px] font-bold">!</span> Mẹo
            </div>
            <p className="text-orange-900/80">{data.tip}</p>
          </div>
        )}

        {data.isRetry && (
          <div className="flex bg-zinc-50 border border-zinc-200 rounded overflow-hidden">
            <input type="number" defaultValue="1" className="w-12 border-none bg-transparent p-1.5 text-center text-sm outline-none text-zinc-600" />
            <div className="flex-1 border-l border-zinc-200 p-1.5 text-sm text-zinc-500 px-3 bg-white">Lần</div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="size-3 bg-white border-2 border-zinc-400" />
      {data.isRetry && (
         <div className="text-xs text-zinc-400 text-right w-full pr-4 pb-3">Lặp lại nhiều hơn</div>
      )}
    </div>
  );
}
