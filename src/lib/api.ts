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
