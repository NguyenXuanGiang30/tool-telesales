import React from 'react';
import { PhoneCall, Play, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { GatewayCallSession } from '../../lib/api';

interface SessionMonitorPanelProps {
  sessions: GatewayCallSession[];
}

export const SessionMonitorPanel: React.FC<SessionMonitorPanelProps> = ({ sessions }) => {
  const getStateIcon = (state: GatewayCallSession['state']) => {
    switch (state) {
      case 'completed':
        return <CheckCircle size={14} className="text-emerald-400" />;
      case 'failed':
        return <AlertTriangle size={14} className="text-rose-400" />;
      case 'ringing':
      case 'dialing':
      case 'connected':
      case 'ai_listening':
      case 'ai_thinking':
      case 'ai_speaking':
        return <Clock size={14} className="text-blue-400 animate-pulse" />;
      case 'queued':
      default:
        return <Play size={14} className="text-slate-400" />;
    }
  };

  const getStateBadgeClass = (state: GatewayCallSession['state']) => {
    switch (state) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'failed':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'queued':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
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
          <PhoneCall size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Gateway Call Sessions</h2>
          <p className="text-xs text-slate-400">
            {sessions.filter(s => !['completed', 'failed'].includes(s.state)).length} active sessions currently enqueued or routing
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto max-h-[350px] pr-2">
        {sessions.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800 border-dashed">
            <p className="text-sm text-slate-500">No call sessions in session manager yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.call_id}
                className="p-4 bg-slate-950/30 rounded-xl border border-slate-850 hover:bg-slate-950/50 transition-colors"
              >
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm">{session.phone_number}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{session.call_id}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded border flex items-center gap-1 ${getStateBadgeClass(
                      session.state
                    )}`}
                  >
                    {getStateIcon(session.state)}
                    {session.state.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-[11px] border-t border-slate-800/40 pt-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Device:</span>
                    <span className="text-slate-300 font-mono">{session.device_id || 'unassigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Created:</span>
                    <span className="text-slate-300">{formatTime(session.created_at)}</span>
                  </div>
                  {session.connected_at && (
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-500">Connected:</span>
                      <span className="text-slate-300">{formatTime(session.connected_at)}</span>
                    </div>
                  )}
                  {session.ended_at && (
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-500">Ended:</span>
                      <span className="text-slate-300">{formatTime(session.ended_at)}</span>
                    </div>
                  )}
                  {session.failure_reason && (
                    <div className="flex justify-between col-span-2 text-rose-400 bg-rose-500/5 p-1 rounded border border-rose-500/10 mt-1">
                      <span>Reason:</span>
                      <span className="font-semibold">{session.failure_reason}</span>
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
