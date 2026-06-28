import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DeviceFleetPanel } from '../DeviceFleetPanel';
import { GatewayDevice } from '../../../lib/api';

const mockDevices: GatewayDevice[] = [
  {
    device_id: 'DEV_01',
    ip_address: '192.168.1.10',
    status: 'idle',
    last_heartbeat_at: new Date().toISOString(),
    health: {
      battery_percent: 85,
      temperature_c: 35,
      signal_dbm: -75,
      charging: false,
      storage_free_mb: 2048,
    },
  },
];

describe('DeviceFleetPanel', () => {
  it('renders registered devices and trigger selection', () => {
    const handleSelectDevice = vi.fn();
    const handleRefresh = vi.fn();

    render(
      <DeviceFleetPanel
        devices={mockDevices}
        selectedDeviceId={null}
        onSelectDevice={handleSelectDevice}
        onRefresh={handleRefresh}
        loading={false}
      />
    );

    expect(screen.getByText('DEV_01')).toBeDefined();
    expect(screen.getByText('192.168.1.10')).toBeDefined();

    // Click the device card to test onSelectDevice callback
    const titleElement = screen.getByText('DEV_01');
    fireEvent.click(titleElement);
    expect(handleSelectDevice).toHaveBeenCalledWith('DEV_01');
  });
});
