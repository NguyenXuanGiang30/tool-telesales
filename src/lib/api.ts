const API_BASE_URL =
  ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ||
  'http://localhost:8000/api/v1';

export interface CampaignRecord {
  id: string;
  user_id?: string | null;
  name: string;
  status: 'running' | 'paused' | 'completed';
  progress: number;
  total: number;
  script: string;
  type: 'callbot' | 'telesale' | 'messages';
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CampaignPayload {
  name: string;
  status?: 'running' | 'paused' | 'completed';
  progress?: number;
  total?: number;
  script?: string;
  type?: 'callbot' | 'telesale' | 'messages';
}

export interface FlowDataPayload {
  campaign_id?: string;
  nodes: string;
  edges: string;
}

export interface ContactImportPayload {
  campaign_id?: string;
  name?: string;
  phone: string;
  email?: string;
  source?: string;
  tags?: string[] | string;
  last_call?: string;
  status?: string;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`API ${response.status}: ${detail || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function listCampaigns(type?: CampaignRecord['type']) {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiFetch<CampaignRecord[]>(`/campaigns${query}`);
}

export function createCampaign(payload: CampaignPayload) {
  return apiFetch<CampaignRecord>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCampaign(id: string, payload: Partial<CampaignPayload>) {
  return apiFetch<CampaignRecord>(`/campaigns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteCampaign(id: string) {
  return apiFetch<{ ok: boolean }>(`/campaigns/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function getCampaignFlow(campaignId: string) {
  return apiFetch<FlowDataPayload>(`/campaigns/${encodeURIComponent(campaignId)}/flow`);
}

export function saveCampaignFlow(campaignId: string, payload: FlowDataPayload) {
  return apiFetch<FlowDataPayload>(`/campaigns/${encodeURIComponent(campaignId)}/flow`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function importContacts(contacts: ContactImportPayload[]) {
  return apiFetch<{ message: string; count: number }>('/contacts/batch', {
    method: 'POST',
    body: JSON.stringify(contacts),
  });
}

export function listGsmPorts() {
  return apiFetch<{ device: string; description: string }[]>('/gsm/ports');
}

export function testGsmConnection(port: string, baudRate: number) {
  return apiFetch<{ ok: boolean; info: any }>('/gsm/test', {
    method: 'POST',
    body: JSON.stringify({ port, baud_rate: baudRate }),
  });
}

// --- GATEWAY / BOXPHONE OPERATIONAL INTERFACES ---
export interface GatewayDevice {
  device_id: string;
  ip_address: string;
  app_version?: string | null;
  audio_port?: number | null;
  status: 'idle' | 'busy' | 'degraded' | 'offline';
  active_call_id?: string | null;
  last_heartbeat_at: string;
  health: {
    battery_percent?: number | null;
    temperature_c?: number | null;
    signal_dbm?: number | null;
    charging?: boolean | null;
    network_type?: string | null;
    storage_free_mb?: number | null;
  };
}

export interface GatewayCallSession {
  call_id: string;
  phone_number: string;
  state: 'queued' | 'dialing' | 'ringing' | 'connected' | 'ai_listening' | 'ai_thinking' | 'ai_speaking' | 'completed' | 'failed';
  device_id?: string | null;
  sim_slot?: number | null;
  campaign_id?: string | null;
  lead_id?: string | null;
  created_at: string;
  dialed_at?: string | null;
  connected_at?: string | null;
  ended_at?: string | null;
  failure_reason?: string | null;
}

export interface GatewayDeviceCommand {
  command_id: string;
  device_id: string;
  command: string;
  call_id?: string | null;
  payload: Record<string, any>;
  status: 'queued' | 'delivered' | 'acked' | 'nacked' | 'expired' | 'failed';
  attempt_count: number;
  created_at: string;
  delivered_at?: string | null;
  acknowledged_at?: string | null;
  expires_at?: string | null;
  last_error?: string | null;
}

export interface AudioSessionMetrics {
  call_id: string;
  device_id: string;
  packets_in: number;
  packets_out: number;
  bytes_in: number;
  bytes_out: number;
  last_input_sequence?: number | null;
  dropped_input_sequences: number;
  last_packet_at?: string | null;
  last_error?: string | null;
}

// --- GATEWAY FETCH FUNCTIONS ---
export function listGatewayDevices() {
  return apiFetch<GatewayDevice[]>('/gateway/devices');
}

export function listGatewaySessions() {
  return apiFetch<GatewayCallSession[]>('/gateway/sessions');
}

export function listGatewayDeviceCommands(deviceId: string) {
  return apiFetch<GatewayDeviceCommand[]>(`/gateway/devices/${encodeURIComponent(deviceId)}/commands`);
}

export function listAudioMetrics() {
  return apiFetch<AudioSessionMetrics[]>('/gateway/audio/metrics');
}
