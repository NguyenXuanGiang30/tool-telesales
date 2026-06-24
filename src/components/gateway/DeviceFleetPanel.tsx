import React from 'react';
import { Smartphone, Battery, Cpu, Thermometer, Wifi, Database, Activity } from 'lucide-react';
import { GatewayDevice } from '../../lib/api';

interface DeviceFleetPanelProps {
  devices: GatewayDevice[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const DeviceFleetPanel: React.FC<DeviceFleetPanelProps> = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onRefresh,
  loading,
}) => {
  const getStatusColor = (status: GatewayDevice['status']) => {
    switch (status) {
      case 'idle':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'busy':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'degraded':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'offline':
      default:
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
            <Smartphone size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Boxphone Device Fleet</h2>
            <p className="text-xs text-slate-400">
              {devices.filter(d => d.status !== 'offline').length} active / {devices.length} total devices registered
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700 flex items-center gap-2 cursor-pointer"
        >
          <Activity size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800 border-dashed">
          <p className="text-sm text-slate-500">No devices registered in the fleet yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((device) => {
            const isSelected = selectedDeviceId === device.device_id;
            return (
              <div
                key={device.device_id}
                onClick={() => onSelectDevice(device.device_id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/80 border-indigo-500/50 shadow-indigo-500/5'
                    : 'bg-slate-950/40 border-slate-850 hover:bg-slate-800/30'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-white text-sm">{device.device_id}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{device.ip_address}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${getStatusColor(
                      device.status
                    )}`}
                  >
                    {device.status}
                  </span>
                </div>

                {device.active_call_id && (
                  <div className="mb-3 px-2 py-1 bg-blue-500/5 border border-blue-500/10 rounded-md">
                    <p className="text-[10px] text-slate-400">Active Call</p>
                    <p className="text-xs font-mono text-blue-300 truncate">{device.active_call_id}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-slate-800/60 pt-3">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Battery size={13} className={device.health?.charging ? 'text-amber-400' : 'text-slate-400'} />
                    <span>
                      {device.health?.battery_percent !== null ? `${device.health.battery_percent}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Thermometer size={13} />
                    <span>
                      {device.health?.temperature_c !== null ? `${device.health.temperature_c}°C` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Wifi size={13} />
                    <span>
                      {device.health?.signal_dbm !== null ? `${device.health.signal_dbm} dBm` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Database size={13} />
                    <span>
                      {device.health?.storage_free_mb !== null ? `${device.health.storage_free_mb} MB` : 'N/A'}
                    </span>
                  </div>
                </div>

                {device.app_version && (
                  <div className="mt-2 text-[10px] text-slate-500 text-right">
                    v{device.app_version}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
