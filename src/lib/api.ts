import type {
  User, Equipment, Reservation, UsageLog, FaultReport,
  Training, TrainingQualification, MaintenancePlan, MaintenanceRecord,
  EquipmentBorrow, Project, Consumable, ConsumableUsage, ConsumableRestock,
  Waitlist, ReportTemplate
} from '../../shared/types.js';

const BASE_URL = '/api';

interface ApiResp<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json() as ApiResp<T>;
  
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<User>('/auth/me'),
    users: () => request<User[]>('/auth/users'),
  },
  equipment: {
    list: (params?: { category?: string; status?: string; lab_id?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return request<Equipment[]>(`/equipment${qs}`);
    },
    get: (id: number) => request<Equipment>(`/equipment/${id}`),
    create: (data: Partial<Equipment>) =>
      request<Equipment>('/equipment', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Equipment>) =>
      request<Equipment>(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/equipment/${id}`, { method: 'DELETE' }),
    labs: () => request<any[]>('/equipment/labs/list'),
  },
  reservations: {
    list: (params?: Record<string, any>) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return request<Reservation[]>(`/reservations${qs}`);
    },
    check: (equipment_id: number, reserve_date: string, time_slot: string) =>
      request<{ available: boolean }>(`/reservations/check?equipment_id=${equipment_id}&reserve_date=${reserve_date}&time_slot=${time_slot}`),
    create: (data: any) =>
      request<Reservation>('/reservations', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: number) =>
      request<Reservation>(`/reservations/${id}/approve`, { method: 'PUT' }),
    reject: (id: number) =>
      request<void>(`/reservations/${id}/reject`, { method: 'PUT' }),
    cancel: (id: number) =>
      request<void>(`/reservations/${id}/cancel`, { method: 'PUT' }),
    autoCancelTimeout: () =>
      request<{ cancelled: number[] }>('/reservations/auto-cancel-timeout', { method: 'POST' }),
  },
  usage: {
    checkin: (data: { equipment_id: number; reservation_id?: number }) =>
      request<UsageLog>('/usage/checkin', { method: 'POST', body: JSON.stringify(data) }),
    checkout: (data: any) =>
      request<UsageLog>('/usage/checkout', { method: 'POST', body: JSON.stringify(data) }),
    logs: () => request<UsageLog[]>('/usage/logs'),
    reportFault: (data: { equipment_id: number; description: string; urgency: string }) =>
      request<FaultReport>('/usage/fault', { method: 'POST', body: JSON.stringify(data) }),
    faults: () => request<FaultReport[]>('/usage/faults'),
    updateFault: (id: number, data: any) =>
      request<FaultReport>(`/usage/faults/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  training: {
    list: (params?: { category?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return request<Training[]>(`/trainings${qs}`);
    },
    create: (data: any) =>
      request<Training>('/trainings', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number) => request<Training>(`/trainings/${id}`),
    take: (id: number, answers: Record<number, string>) =>
      request<{ passed: boolean; correctCount: number; totalCount: number; message: string }>(
        `/trainings/${id}/take`, { method: 'POST', body: JSON.stringify({ answers }) }
      ),
    qualifications: (user_id?: number) => {
      const qs = user_id ? `?user_id=${user_id}` : '';
      return request<TrainingQualification[]>(`/trainings/qualifications/list${qs}`);
    },
  },
  statistics: {
    overview: () => request<any>('/statistics/overview'),
    usageRate: () => request<any[]>('/statistics/usage-rate'),
    popularEquip: () => request<any[]>('/statistics/popular-equip'),
    labFrequency: () => request<any[]>('/statistics/lab-frequency'),
    userRanking: () => request<any[]>('/statistics/user-ranking'),
    faultStats: () => request<any>('/statistics/fault-stats'),
  },
  maintenance: {
    plans: () => request<MaintenancePlan[]>('/maintenance/plans'),
    createPlan: (data: any) =>
      request<MaintenancePlan>('/maintenance/plans', { method: 'POST', body: JSON.stringify(data) }),
    updatePlan: (id: number, data: any) =>
      request<MaintenancePlan>(`/maintenance/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    records: (equipment_id?: number) => {
      const qs = equipment_id ? `?equipment_id=${equipment_id}` : '';
      return request<MaintenanceRecord[]>(`/maintenance/records${qs}`);
    },
    createRecord: (data: any) =>
      request<MaintenanceRecord>('/maintenance/records', { method: 'POST', body: JSON.stringify(data) }),
    lifecycle: (equipmentId: number) => request<any>(`/maintenance/lifecycle/${equipmentId}`),
    dueSoon: (days?: number) => {
      const qs = days ? `?days=${days}` : '';
      return request<MaintenancePlan[]>(`/maintenance/due-soon${qs}`);
    },
  },
  borrows: {
    list: (params?: Record<string, any>) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return request<EquipmentBorrow[]>(`/borrows${qs}`);
    },
    create: (data: any) =>
      request<EquipmentBorrow>('/borrows', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: number) =>
      request<EquipmentBorrow>(`/borrows/${id}/approve`, { method: 'PUT' }),
    reject: (id: number) =>
      request<void>(`/borrows/${id}/reject`, { method: 'PUT' }),
    returnBorrow: (id: number) =>
      request<EquipmentBorrow>(`/borrows/${id}/return`, { method: 'PUT' }),
  },
  projects: {
    list: () => request<Project[]>('/projects'),
    get: (id: number) => request<Project>(`/projects/${id}`),
    create: (data: any) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    addMember: (projectId: number, studentId: number) =>
      request<void>(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ student_id: studentId }) }),
    removeMember: (projectId: number, studentId: number) =>
      request<void>(`/projects/${projectId}/members/${studentId}`, { method: 'DELETE' }),
    addEquipment: (projectId: number, equipmentId: number) =>
      request<void>(`/projects/${projectId}/equipment`, { method: 'POST', body: JSON.stringify({ equipment_id: equipmentId }) }),
    removeEquipment: (projectId: number, equipmentId: number) =>
      request<void>(`/projects/${projectId}/equipment/${equipmentId}`, { method: 'DELETE' }),
    usageStats: (id: number) => request<any>(`/projects/${id}/usage-stats`),
  },
  consumables: {
    list: (params?: Record<string, any>) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return request<Consumable[]>(`/consumables${qs}`);
    },
    get: (id: number) => request<Consumable>(`/consumables/${id}`),
    create: (data: any) =>
      request<Consumable>('/consumables', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<Consumable>(`/consumables/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/consumables/${id}`, { method: 'DELETE' }),
    recordUsage: (id: number, data: any) =>
      request<any>(`/consumables/${id}/usage`, { method: 'POST', body: JSON.stringify(data) }),
    usageHistory: (id: number) => request<ConsumableUsage[]>(`/consumables/${id}/usage-history`),
    restock: (id: number, data: any) =>
      request<any>(`/consumables/${id}/restock`, { method: 'POST', body: JSON.stringify(data) }),
    restockHistory: (id: number) => request<ConsumableRestock[]>(`/consumables/${id}/restock-history`),
    alerts: () => request<Consumable[]>('/consumables/alerts/list'),
  },
  waitlist: {
    list: (params?: Record<string, any>) => {
      const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return request<Waitlist[]>(`/waitlist${qs}`);
    },
    join: (data: any) =>
      request<Waitlist>('/waitlist', { method: 'POST', body: JSON.stringify(data) }),
    cancel: (id: number) =>
      request<void>(`/waitlist/${id}/cancel`, { method: 'PUT' }),
    position: (id: number) => request<{ position: number }>(`/waitlist/${id}/position`),
  },
  reports: {
    templates: () => request<ReportTemplate[]>('/reports/templates'),
    getTemplate: (id: number) => request<ReportTemplate>(`/reports/templates/${id}`),
    createTemplate: (data: any) =>
      request<ReportTemplate>('/reports/templates', { method: 'POST', body: JSON.stringify(data) }),
    deleteTemplate: (id: number) => request<void>(`/reports/templates/${id}`, { method: 'DELETE' }),
    generate: (data: any) =>
      request<any[]>('/reports/generate', { method: 'POST', body: JSON.stringify(data) }),
    exportCsv: (params: Record<string, any>) => {
      const qs = '?' + new URLSearchParams(params as any).toString();
      return request<string>(`/reports/export/csv${qs}`);
    },
    exportPdf: (params: Record<string, any>) => {
      const qs = '?' + new URLSearchParams(params as any).toString();
      return request<string>(`/reports/export/pdf${qs}`);
    },
  },
};
