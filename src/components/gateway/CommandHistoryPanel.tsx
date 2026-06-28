import React from 'react';
import { Terminal, Send, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { GatewayDeviceCommand } from '../../lib/api';

interface CommandHistoryPanelProps {
  deviceId: string | null;
  commands: GatewayDeviceCommand[];
  loading: boolean;
}

export const CommandHistoryPanel: React.FC<CommandHistoryPanelProps> = ({
  deviceId,
  commands,
  loading,
}) => {
  const getStatusIcon = (status: GatewayDeviceCommand['status']) => {
    switch (status) {
      case 'acked':
        return <CheckCircle size={14} className="text-emerald-400" />;
      case 'nacked':
      case 'failed':
        return <XCircle size={14} className="text-rose-400" />;
      case 'delivered':
        return <Send size={14} className="text-blue-400" />;
      case 'expired':
        return <AlertTriangle size={14} className="text-amber-400" />;
      case 'queued':
      default:
        return <Clock size={14} className="text-slate-400 animate-pulse" />;
    }
  };

  const getStatusClass = (status: GatewayDeviceCommand['status']) => {
    switch (status) {
      case 'acked':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'nacked':
      case 'failed':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'delivered':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'expired':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'queued':
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
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
          <Terminal size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Device Command Queue</h2>
          <p className="text-xs text-slate-400">
            {deviceId ? `Showing command logs for ${deviceId}` : 'Select a device to view command history'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto max-h-[350px] pr-2">
        {!deviceId ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800 border-dashed">
            <p className="text-sm text-slate-500">Select a device from the fleet to inspect command queue.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            <p className="text-sm text-slate-400 mt-3">Loading commands...</p>
          </div>
        ) : commands.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800 border-dashed">
            <p className="text-sm text-slate-500">No commands have been enqueued for this device.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {commands.map((cmd) => (
              <div
                key={cmd.command_id}
                className="p-4 bg-slate-950/30 rounded-xl border border-slate-850"
              >
                <div className="flex justify-between items-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white font-mono">{cmd.command}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({cmd.attempt_count > 0 ? `${cmd.attempt_count} attempts` : 'queued'})</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded border flex items-center gap-1 ${getStatusClass(
                      cmd.status
                    )}`}
                  >
                    {getStatusIcon(cmd.status)}
                    {cmd.status}
                  </span>
                </div>

                {cmd.payload && Object.keys(cmd.payload).length > 0 && (
                  <pre className="text-[10px] font-mono bg-slate-950/80 p-2 rounded-md border border-slate-850 text-indigo-300 overflow-x-auto mb-2.5">
                    {JSON.stringify(cmd.payload, null, 2)}
                  </pre>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-400 border-t border-slate-800/40 pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sent:</span>
                    <span>{formatTime(cmd.created_at)}</span>
                  </div>
                  {cmd.acknowledged_at && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Acked:</span>
                      <span>{formatTime(cmd.acknowledged_at)}</span>
                    </div>
                  )}
                  {cmd.last_error && (
                    <div className="flex justify-between col-span-2 text-rose-400 bg-rose-500/5 p-1 rounded border border-rose-500/10 mt-1">
                      <span>Error:</span>
                      <span className="font-semibold">{cmd.last_error}</span>
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
