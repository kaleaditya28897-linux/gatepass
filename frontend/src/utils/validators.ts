import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  slug: z.string().min(1, 'Slug is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  floor: z.string().optional(),
  suite_number: z.string().optional(),
  max_employees: z.number().min(1).default(50),
})

export const employeeSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  company: z.number(),
  employee_id: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
})

export const passSchema = z.object({
  visitor_name: z.string().min(1, 'Visitor name is required'),
  visitor_phone: z.string().min(1, 'Phone is required'),
  visitor_email: z.string().email().optional().or(z.literal('')),
  visitor_company: z.string().optional(),
  purpose: z.string().optional(),
  host_company: z.number(),
  host_employee: z.number().optional(),
  valid_from: z.string(),
  valid_until: z.string(),
})

export const deliverySchema = z.object({
  delivery_type: z.enum(['food_order', 'courier', 'document', 'other']),
  platform_name: z.string().optional(),
  order_id: z.string().optional(),
  delivery_person_name: z.string().optional(),
  delivery_person_phone: z.string().optional(),
  expected_at: z.string().optional(),
  notes: z.string().optional(),
})

export const gateSchema = z.object({
  name: z.string().min(1, 'Gate name is required'),
  code: z.string().min(1, 'Gate code is required'),
  location: z.string().optional(),
  gate_type: z.enum(['pedestrian', 'vehicle', 'service']),
})

export const guardSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  badge_number: z.string().min(1, 'Badge number is required'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CompanyInput = z.infer<typeof companySchema>
export type EmployeeInput = z.infer<typeof employeeSchema>
export type PassInput = z.infer<typeof passSchema>
export type DeliveryInput = z.infer<typeof deliverySchema>
export type GateInput = z.infer<typeof gateSchema>
export type GuardInput = z.infer<typeof guardSchema>
