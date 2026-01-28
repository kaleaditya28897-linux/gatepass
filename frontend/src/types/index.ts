export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'company' | 'employee' | 'guard'
  phone: string
  avatar: string | null
  company?: { id: number; name: string; slug: string } | null
}

export interface Company {
  id: number
  name: string
  slug: string
  admin: number | null
  admin_name: string | null
  floor: string
  suite_number: string
  phone: string
  email: string
  logo: string | null
  max_employees: number
  is_active: boolean
  employee_count: number
  created_at: string
  updated_at: string
}

export interface Employee {
  id: number
  user: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone: string
  company: number
  company_name: string
  employee_id: string
  designation: string
  department: string
  created_at: string
  updated_at: string
}

export interface Gate {
  id: number
  name: string
  code: string
  location: string
  gate_type: 'pedestrian' | 'vehicle' | 'service'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Guard {
  id: number
  user: number
  username: string
  full_name: string
  email: string
  phone: string
  badge_number: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GuardShift {
  id: number
  guard: number
  guard_name: string
  gate: number
  gate_name: string
  shift_start: string
  shift_end: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VisitorPass {
  id: number
  visitor_name: string
  visitor_phone: string
  visitor_email: string
  visitor_company: string
  id_type: string
  id_number: string
  photo: string | null
  vehicle_number: string
  purpose: string
  host_company: number
  host_company_name: string
  host_employee: number | null
  host_employee_name: string | null
  pass_code: string
  qr_code_image: string | null
  pass_type: 'pre_approved' | 'walk_in' | 'recurring'
  status: 'pending' | 'approved' | 'checked_in' | 'checked_out' | 'expired' | 'rejected' | 'cancelled'
  valid_from: string
  valid_until: string
  created_by: number | null
  created_by_name: string | null
  approved_by: number | null
  approved_by_name: string | null
  approved_at: string | null
  rejected_reason: string
  pass_url: string
  created_at: string
  updated_at: string
}

export interface EntryLog {
  id: number
  visitor_pass: number | null
  delivery: number | null
  entry_type: 'visitor' | 'delivery'
  gate: number
  gate_name: string
  checked_in_by: number
  checked_in_by_name: string
  checked_out_by: number | null
  checked_out_by_name: string | null
  check_in_time: string
  check_out_time: string | null
  visitor_name: string
  phone: string
  company_name: string
  created_at: string
  updated_at: string
}

export interface Delivery {
  id: number
  company: number
  company_name: string
  employee: number
  employee_name: string
  delivery_type: 'food_order' | 'courier' | 'document' | 'other'
  status: 'expected' | 'arrived' | 'delivered' | 'rejected' | 'cancelled'
  platform_name: string
  order_id: string
  delivery_person_name: string
  delivery_person_phone: string
  expected_at: string | null
  otp_code: string
  notes: string
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  user: number | null
  user_name: string | null
  action: string
  resource_type: string
  resource_id: string
  description: string
  ip_address: string | null
  extra_data: Record<string, unknown>
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface LoginResponse {
  access: string
  refresh: string
  user: User
}

export interface AnalyticsOverview {
  total_companies: number
  total_passes_today: number
  active_visitors: number
  pending_deliveries: number
  checked_in_today: number
  checked_out_today: number
}
