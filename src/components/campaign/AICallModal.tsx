/* oxlint-disable react-doctor/prefer-useReducer, react-doctor/design-no-space-on-flex-children */
import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Activity, Loader2, Volume2 } from 'lucide-react';

// Static VU meter bar definitions (stable keys, avoids array-index-as-key)
const VU_BARS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ id: `vu-bar-${i}`, threshold: i * 5 }));

interface AICallModalProps {
  leadName: string;
  leadPhone: string;
  onClose: () => void;
  onComplete: (status: string, note: string) => void;
}

type CallState = 'IDLE' | 'DIALING' | 'CONNECTED' | 'DISCONNECTED';
type AIState = 'LISTENING' | 'THINKING' | 'SPEAKING';

export default function AICallModal({ leadName, leadPhone, onClose, onComplete }: AICallModalProps) {
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [aiState, setAiState] = useState<AIState>('LISTENING');
  const [logs, setLogs] = useState<{ id: string, role: 'ai' | 'user' | 'system', text: string }[]>([]);
  const [timer, setTimer] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ringingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'CONNECTED') {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const addLog = (role: 'ai' | 'user' | 'system', text: string) => {
    setLogs(prev => [...prev, { id: `${Date.now()}-${prev.length}`, role, text }]);
  };

  const startCall = async () => {
    setCallState('DIALING');
    addLog('system', `Đang gọi cho ${leadName} (${leadPhone})...`);

    ringingTimerRef.current = setTimeout(() => {
      if (callState === 'DIALING') {
        addLog('system', `Không bắt máy (Timeout). Tự động ngắt kết nối.`);
        endCall('no-answer', 'Khách hàng không bắt máy cuộc gọi (AI tự ngắt).');
      }
    }, 12000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Khởi tạo WebSocket tới Python Backend
      const wsUrl = "ws://localhost:8000/ws/voice-agent";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
         console.log("WebSocket connected!");
      };

      ws.onmessage = async (e) => {
         if (typeof e.data === 'string') {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'status') {
                    if (msg.text === 'USER_SPEAKING') setAiState('LISTENING');
                    else if (msg.text === 'THINKING') setAiState('THINKING');
                    else if (msg.text === 'SPEAKING') setAiState('SPEAKING');
                    else if (msg.text === 'LISTENING') setAiState('LISTENING');
                }
                else if (msg.type === 'system') {
                    addLog('system', msg.text);
                }
                else if (msg.type === 'transcript') {
                    if (msg.text) addLog('user', msg.text);
                }
                else if (msg.type === 'intent') {
                    addLog('ai', msg.text);
                }
            } catch (err) {
                console.error("JSON parse error:", err);
            }
         } else if (e.data instanceof Blob) {
             // Phát Audio PCM 16-bit 16kHz Mono từ Server
             if (!audioContextRef.current) return;
             const arrayBuffer = await e.data.arrayBuffer();
             const int16 = new Int16Array(arrayBuffer);
             const float32 = new Float32Array(int16.length);
             for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 32768.0;
             
             const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 16000);
             audioBuffer.copyToChannel(float32, 0);
             const source = audioContextRef.current.createBufferSource();
             source.buffer = audioBuffer;
             source.connect(audioContextRef.current.destination);
             source.start();
         }
      };

      ws.onerror = () => {
         addLog('system', "Lỗi kết nối WebSocket tới AI Server. Hãy chắc chắn backend đang chạy tại localhost:8000.");
         endCall('error', "Lỗi kết nối AI Server");
      };

      ws.onclose = () => {
         console.log("WebSocket closed");
      };

      // Đợi giả lập nhấc máy sau 2s
      setTimeout(() => {
        if (ringingTimerRef.current) clearTimeout(ringingTimerRef.current);
        if (ws.readyState === WebSocket.OPEN) {
            setCallState('CONNECTED');
            addLog('system', `Cuộc gọi được kết nối tới AI Server.`);
            setupAudioStreaming(stream, ws);
        } else {
            endCall('error', 'Chưa kết nối được với backend.');
        }
      }, 2000);

    } catch (err) {
      addLog('system', 'Lỗi Micro: Không thể truy cập Micro của bạn.');
      setCallState('DISCONNECTED');
    }
  };

  const setupAudioStreaming = (stream: MediaStream, ws: WebSocket) => {
    // Ép kiểu sampleRate 16000 để khớp với Python Whisper & VAD
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    audioContextRef.current = audioCtx;
    
    const source = audioCtx.createMediaStreamSource(stream);
    
    // Tạo Analyser để vẽ VU Meter
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const updateVU = () => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setVolumeLevel(sum / dataArray.length);
        requestAnimationFrame(updateVU);
    };
    updateVU();

    // Lấy raw PCM đẩy qua WebSocket
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    source.connect(processor);
    processor.connect(audioCtx.destination);
    
    processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            ws.send(pcm16.buffer); // Gửi dữ liệu nhị phân (binary blob) trực tiếp
        }
    };
  };

  const endCall = (status = 'transferred', note = 'Cuộc gọi kết thúc.') => {
    setCallState('DISCONNECTED');
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }
    if (processorRef.current && audioContextRef.current) {
        processorRef.current.disconnect();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (ringingTimerRef.current) clearTimeout(ringingTimerRef.current);
    
    setTimeout(() => {
       onComplete(status, note);
       onClose();
    }, 2000);
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col h-[600px]">
        {/* Header */}
        <div className="bg-zinc-800 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className={`size-12 rounded-full flex items-center justify-center ${callState === 'CONNECTED' ? 'bg-violet-500' : 'bg-zinc-700'}`}>
                    <Phone className={callState === 'CONNECTED' ? 'animate-pulse' : ''} size={24} />
                </div>
                <div>
                   <h3 className="font-semibold text-lg">{leadName}</h3>
                   <div className="text-zinc-300 text-sm font-mono">{leadPhone}</div>
                </div>
            </div>
            {callState === 'CONNECTED' && (
                <div className="text-xl font-medium tracking-wider">{formatTime(timer)}</div>
            )}
        </div>

        {/* Status Bar */}
        <div className="bg-zinc-100 p-3 flex items-center justify-between border-b border-zinc-200">
           <div className="flex items-center gap-2">
               {callState === 'DIALING' && <><Loader2 size={16} className="animate-spin text-amber-500"/><span className="text-sm font-medium text-amber-600">Đang khởi tạo WebSocket…</span></>}
               {callState === 'DISCONNECTED' && <><PhoneOff size={16} className="text-rose-500"/><span className="text-sm font-medium text-rose-600">Đã ngắt kết nối</span></>}
               {callState === 'CONNECTED' && (
                   <>
                     {aiState === 'LISTENING' && <><Activity size={16} className="text-blue-500 "/><span className="text-sm font-medium text-blue-600">AI đang nghe (Live Audio Stream)</span></>}
                     {aiState === 'THINKING' && <><Loader2 size={16} className="animate-spin text-purple-500"/><span className="text-sm font-medium text-purple-600">Whisper & Gemma đang xử lý…</span></>}
                     {aiState === 'SPEAKING' && <><Volume2 size={16} className="animate-pulse text-emerald-500"/><span className="text-sm font-medium text-emerald-600">Nhận Audio TTS từ AI Server</span></>}
                   </>
               )}
           </div>
           
           {/* VU Meter */}
           {callState === 'CONNECTED' && (
              <div className="flex items-end h-6 gap-0.5">
                  {VU_BARS.map((bar) => (
                      <div key={bar.id} className={`w-1.5 rounded-t-sm transition-all duration-75 ${volumeLevel > bar.threshold ? 'bg-violet-500' : 'bg-zinc-300'}`} style={{ height: Math.max(4, Math.min(24, (volumeLevel / 50) * 24)) + 'px' }}></div>
                  ))}
              </div>
           )}
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50">
            {callState === 'IDLE' ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-zinc-500">
                    <p>Sẵn sàng gọi lên Server qua WebSocket.</p>
                    <ul className="text-xs text-left list-disc list-inside space-y-2 max-w-[80%] bg-white p-4 rounded-xl border border-zinc-200">
                        <li>Dữ liệu Audio được stream realtime (16kHz).</li>
                        <li>Server xử lý VAD -&gt; Whisper (STT) -&gt; Gemma 2 (LLM).</li>
                        <li>Nhận lại Audio từ TTS Model (VITS).</li>
                    </ul>
                </div>
            ) : (
                logs.map((log, idx) => (
                   <div key={log.id} className={`flex flex-col ${log.role === 'ai' ? 'items-start' : log.role === 'user' ? 'items-end' : 'items-center'} w-full`}>
                      {log.role === 'system' ? (
                          <div className="bg-zinc-200/50 text-zinc-500 text-xs px-3 py-1 rounded-full">{log.text}</div>
                      ) : (
                          <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${log.role === 'ai' ? 'bg-white border text-zinc-700 border-zinc-200 rounded-tl-none' : 'bg-violet-600 text-white rounded-tr-none'}`}>
                              {log.role === 'ai' && <div className="text-[10px] font-bold text-violet-500 mb-1 uppercase">Gemma 2 Agent</div>}
                              {log.text}
                          </div>
                      )}
                   </div>
                ))
            )}
            <div ref={logsEndRef} />
        </div>

        {/* Actions */}
        <div className="p-4 bg-white border-t border-zinc-200 grid grid-cols-2 gap-3">
             {callState === 'IDLE' ? (
                 <button onClick={startCall} className="col-span-2 bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30">
                     <Phone size={18} /> Bắt đầu gọi bằng Real Models
                 </button>
             ) : (
                 <>
                    <button onClick={() => endCall('transferred', `Cuộc gọi bằng AI dài ${formatTime(timer)}`)} className="col-span-2 bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30">
                        <PhoneOff size={18} /> Ngắt kết nối
                    </button>
                 </>
             )}
        </div>
      </div>
    </div>
  );
}
