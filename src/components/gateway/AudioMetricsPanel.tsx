import React from 'react';
import { Volume2, ArrowDownRight, ArrowUpRight, ShieldAlert, WifiOff, FileAudio } from 'lucide-react';
import { AudioSessionMetrics } from '../../lib/api';

interface AudioMetricsPanelProps {
  metrics: AudioSessionMetrics[];
}

export const AudioMetricsPanel: React.FC<AudioMetricsPanelProps> = ({ metrics }) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '-';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
          <Volume2 size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Audio Stream Metrics</h2>
          <p className="text-xs text-slate-400">Real-time packet transmission, drops, and stream status</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto max-h-[350px] pr-2">
        {metrics.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800 border-dashed">
            <p className="text-sm text-slate-500">No active audio streams detected.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {metrics.map((m) => (
              <div
                key={m.call_id}
                className="p-4 bg-slate-950/30 rounded-xl border border-slate-850"
              >
                <div className="flex justify-between items-center gap-4 mb-3 pb-2 border-b border-slate-800/40">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-indigo-400 font-mono truncate">Call: {m.call_id}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Device: {m.device_id}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                    <FileAudio size={11} className="animate-pulse" />
                    Streaming
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* RX Card */}
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/40 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Received (RX)</p>
                      <p className="text-sm font-bold text-white mt-0.5">{formatBytes(m.bytes_in)}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{m.packets_in} pkts</p>
                    </div>
                    <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md">
                      <ArrowDownRight size={14} />
                    </div>
                  </div>

                  {/* TX Card */}
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/40 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Transmitted (TX)</p>
                      <p className="text-sm font-bold text-white mt-0.5">{formatBytes(m.bytes_out)}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{m.packets_out} pkts</p>
                    </div>
                    <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md">
                      <ArrowUpRight size={14} />
                    </div>
                  </div>
                </div>

                {/* Packet loss and drop indicators */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-400 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center gap-1">
                      <ShieldAlert size={12} className="text-amber-400" />
                      Sequence Drops:
                    </span>
                    <span className={`font-mono font-bold ${m.dropped_input_sequences > 0 ? 'text-amber-400 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10' : 'text-slate-300'}`}>
                      {m.dropped_input_sequences}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Last Seq (In):</span>
                    <span className="text-slate-300 font-mono">{m.last_input_sequence ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center col-span-2">
                    <span className="text-slate-500">Last Packet Active:</span>
                    <span className="text-slate-300 font-mono">{formatTime(m.last_packet_at)}</span>
                  </div>
                  {m.last_error && (
                    <div className="flex justify-between col-span-2 text-rose-400 bg-rose-500/5 p-1.5 rounded border border-rose-500/10 mt-1.5 items-center gap-1.5">
                      <WifiOff size={13} className="shrink-0" />
                      <span className="font-semibold break-all text-[10px]">{m.last_error}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
