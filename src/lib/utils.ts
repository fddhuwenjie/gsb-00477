import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORY_LABELS: Record<string, string> = {
  analyzer: '分析仪器',
  optical: '光学设备',
  electronic: '电子测量',
  chemical: '化学设备',
  computing: '计算设备',
};

export const STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  repairing: '维修中',
  scrapped: '报废',
};

export const STATUS_COLORS: Record<string, string> = {
  normal: 'bg-emerald-100 text-emerald-700',
  repairing: 'bg-amber-100 text-amber-700',
  scrapped: 'bg-slate-100 text-slate-700',
};

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  completed: '已完成',
  cancelled: '已取消',
};

export const RESERVATION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午 (8:00-12:00)',
  afternoon: '下午 (14:00-18:00)',
  evening: '晚上 (19:00-23:00)',
};

export const URGENCY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

export const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export const FAULT_STATUS_LABELS: Record<string, string> = {
  reported: '已报告',
  processing: '处理中',
  resolved: '已解决',
};

export const FAULT_STATUS_COLORS: Record<string, string> = {
  reported: 'bg-red-100 text-red-700',
  processing: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

export const MAINTENANCE_FREQUENCY_LABELS: Record<string, string> = {
  monthly: '每月',
  quarterly: '每季度',
  yearly: '每年',
};

export const ROLE_LABELS: Record<string, string> = {
  student: '学生',
  tutor: '导师',
  admin: '管理员',
};

export function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export const BORROW_STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
  returned: '已归还',
};

export const BORROW_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  returned: 'bg-slate-100 text-slate-700',
};

export const WAITLIST_STATUS_LABELS: Record<string, string> = {
  waiting: '排队中',
  promoted: '已转正',
  cancelled: '已取消',
};

export const WAITLIST_STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-amber-100 text-amber-700',
  promoted: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export const REPORT_DIMENSION_LABELS: Record<string, string> = {
  equipment: '按设备',
  user: '按用户',
  lab: '按实验室',
  time: '按时间段',
};

export const REPORT_METRIC_LABELS: Record<string, string> = {
  usage_count: '使用次数',
  usage_duration: '使用时长',
  fault_count: '故障次数',
  maintenance_cost: '维护成本',
};

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const el = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800';
  el.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${bg} animate-pulse`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
