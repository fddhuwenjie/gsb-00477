export type UserRole = 'student' | 'tutor' | 'admin';
export type EquipmentStatus = 'normal' | 'repairing' | 'scrapped';
export type EquipmentCategory = 'analyzer' | 'optical' | 'electronic' | 'chemical' | 'computing';
export type TimeSlot = 'morning' | 'afternoon' | 'evening';
export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type FaultStatus = 'reported' | 'processing' | 'resolved';
export type MaintenanceFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
}

export interface Lab {
  id: number;
  name: string;
  location: string;
  description?: string;
}

export interface Equipment {
  id: number;
  name: string;
  model: string;
  lab_id: number;
  manager_id: number;
  status: EquipmentStatus;
  purchase_no?: string;
  unit_price?: number;
  purchase_date?: string;
  category: EquipmentCategory;
  photo_url?: string;
  precautions?: string;
  lab_name?: string;
  manager_name?: string;
}

export interface Reservation {
  id: number;
  equipment_id: number;
  student_id: number;
  tutor_id: number;
  project_id?: number;
  reserve_date: string;
  time_slot: TimeSlot;
  purpose: string;
  status: ReservationStatus;
  created_at: string;
  approved_at?: string;
  equipment_name?: string;
  student_name?: string;
  tutor_name?: string;
  project_name?: string;
}

export interface UsageLog {
  id: number;
  reservation_id?: number;
  equipment_id: number;
  user_id: number;
  checkin_time: string;
  checkout_time?: string;
  experiment_content?: string;
  equipment_status?: string;
  has_anomaly: boolean;
  sample_count?: number;
  equipment_name?: string;
  user_name?: string;
}

export interface FaultReport {
  id: number;
  equipment_id: number;
  reporter_id: number;
  description: string;
  urgency: Urgency;
  status: FaultStatus;
  created_at: string;
  resolved_at?: string;
  resolution?: string;
  equipment_name?: string;
  reporter_name?: string;
}

export interface Training {
  id: number;
  name: string;
  content: string;
  category: EquipmentCategory;
  created_at: string;
  questions?: TrainingQuestion[];
}

export interface TrainingQuestion {
  id: number;
  training_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
}

export interface TrainingQualification {
  id: number;
  user_id: number;
  training_id: number;
  category: EquipmentCategory;
  passed_date: string;
  expiry_date: string;
  is_valid: boolean;
  training_name?: string;
}

export interface MaintenancePlan {
  id: number;
  equipment_id: number;
  frequency: MaintenanceFrequency;
  content: string;
  next_due_date: string;
  is_active: boolean;
  equipment_name?: string;
}

export interface MaintenanceRecord {
  id: number;
  equipment_id: number;
  plan_id?: number;
  maintainer_id?: number;
  maintenance_date: string;
  content: string;
  replaced_parts?: string;
  cost?: number;
  equipment_name?: string;
  maintainer_name?: string;
}

export type BorrowStatus = 'pending' | 'approved' | 'rejected' | 'returned';

export interface EquipmentBorrow {
  id: number;
  equipment_id: number;
  borrower_id: number;
  from_lab_id: number;
  to_lab_id: number;
  borrow_date: string;
  return_date: string;
  status: BorrowStatus;
  created_at: string;
  approved_at?: string;
  equipment_name?: string;
  borrower_name?: string;
  from_lab_name?: string;
  to_lab_name?: string;
}

export interface Project {
  id: number;
  name: string;
  tutor_id: number;
  start_date: string;
  end_date: string;
  description?: string;
  created_at: string;
  tutor_name?: string;
  members?: ProjectMember[];
  equipment_list?: ProjectEquipment[];
}

export interface ProjectMember {
  id: number;
  project_id: number;
  student_id: number;
  student_name?: string;
  joined_at: string;
}

export interface ProjectEquipment {
  id: number;
  project_id: number;
  equipment_id: number;
  equipment_name?: string;
}

export interface Consumable {
  id: number;
  name: string;
  equipment_id: number;
  current_stock: number;
  safety_stock: number;
  unit: string;
  unit_price: number;
  supplier?: string;
  equipment_name?: string;
}

export interface ConsumableUsage {
  id: number;
  consumable_id: number;
  usage_log_id?: number;
  quantity: number;
  used_at: string;
  user_id: number;
  consumable_name?: string;
  user_name?: string;
}

export interface ConsumableRestock {
  id: number;
  consumable_id: number;
  quantity: number;
  unit_price: number;
  restocked_at: string;
  operator_id: number;
  consumable_name?: string;
  operator_name?: string;
}

export type WaitlistStatus = 'waiting' | 'promoted' | 'cancelled';

export interface Waitlist {
  id: number;
  equipment_id: number;
  student_id: number;
  reserve_date: string;
  time_slot: TimeSlot;
  purpose: string;
  status: WaitlistStatus;
  created_at: string;
  promoted_at?: string;
  cancelled_at?: string;
  equipment_name?: string;
  student_name?: string;
  position?: number;
  status_changed_at?: string;
}

export interface ReportTemplate {
  id: number;
  name: string;
  dimensions: string[];
  metrics: string[];
  date_range_start?: string;
  date_range_end?: string;
  created_by: number;
  created_at: string;
  creator_name?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
