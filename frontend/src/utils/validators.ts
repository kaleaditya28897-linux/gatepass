import { z } from 'zod'

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number')
const optionalPhone = phone.optional().or(z.literal(''))
const optionalEmail = z.string().trim().email('Enter a valid email').optional().or(z.literal(''))
const password = z.string().min(8, 'Use at least 8 characters')

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const companySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required'),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only'),
  email: optionalEmail,
  phone: optionalPhone,
  floor: z.string().optional(),
  suite_number: z.string().optional(),
  max_employees: z.coerce.number().int().min(1, 'At least 1').max(100000),
  is_active: z.boolean(),
  admin_username: z.string().trim().optional(),
  admin_first_name: z.string().trim().optional(),
  admin_last_name: z.string().trim().optional(),
  admin_email: optionalEmail,
  admin_password: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.admin_username) {
    if (!data.admin_first_name) ctx.addIssue({ code: 'custom', path: ['admin_first_name'], message: 'Required' })
    if (!data.admin_password || data.admin_password.length < 8) {
      ctx.addIssue({ code: 'custom', path: ['admin_password'], message: 'Use at least 8 characters' })
    }
  }
})

export const employeeCreateSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  email: z.string().trim().email('Enter a valid email'),
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  phone: optionalPhone,
  password,
  company: z.coerce.number().optional(),
  employee_id: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
})

export const employeeEditSchema = employeeCreateSchema
  .omit({ username: true, password: true, company: true })
  .extend({ is_active: z.boolean() })

export const passSchema = z.object({
  visitor_name: z.string().trim().min(1, 'Visitor name is required'),
  visitor_phone: phone,
  visitor_email: optionalEmail,
  visitor_company: z.string().optional(),
  vehicle_number: z.string().max(20).optional(),
  purpose: z.string().optional(),
  pass_type: z.enum(['pre_approved', 'recurring']),
  host_company: z.coerce.number().optional(),
  host_employee: z.coerce.number().optional(),
  valid_from: z.string().min(1, 'Required'),
  valid_until: z.string().min(1, 'Required'),
}).superRefine((data, ctx) => {
  if (data.valid_from && data.valid_until) {
    const until = new Date(data.valid_until)
    if (until <= new Date(data.valid_from)) {
      ctx.addIssue({ code: 'custom', path: ['valid_until'], message: 'Must be after the start time' })
    } else if (until <= new Date()) {
      ctx.addIssue({ code: 'custom', path: ['valid_until'], message: 'Must be in the future' })
    }
  }
})

export const walkInSchema = z.object({
  visitor_name: z.string().trim().min(1, 'Visitor name is required'),
  visitor_phone: phone,
  visitor_company: z.string().optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  vehicle_number: z.string().max(20).optional(),
  purpose: z.string().optional(),
  host_company: z.coerce.number({ invalid_type_error: 'Choose a company' }).min(1, 'Choose a company'),
  host_employee: z.coerce.number().optional(),
})

export const deliverySchema = z.object({
  employee: z.coerce.number().optional(),
  delivery_type: z.enum(['food_order', 'courier', 'document', 'other']),
  platform_name: z.string().optional(),
  order_id: z.string().optional(),
  expected_at: z.string().optional(),
  notes: z.string().optional(),
})

export const gateSchema = z.object({
  name: z.string().trim().min(1, 'Gate name is required'),
  code: z.string().trim().min(1, 'Gate code is required').max(20),
  location: z.string().optional(),
  gate_type: z.enum(['pedestrian', 'vehicle', 'service']),
  is_active: z.boolean(),
})

export const guardCreateSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  email: optionalEmail,
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().optional(),
  phone: optionalPhone,
  password,
  badge_number: z.string().trim().min(1, 'Badge number is required'),
})

export const guardEditSchema = guardCreateSchema
  .omit({ username: true, password: true })
  .extend({ is_active: z.boolean() })

export const shiftSchema = z.object({
  guard: z.coerce.number().min(1, 'Choose a guard'),
  gate: z.coerce.number().min(1, 'Choose a gate'),
  shift_start: z.string().min(1, 'Required'),
  shift_end: z.string().min(1, 'Required'),
}).refine((d) => !d.shift_start || !d.shift_end || new Date(d.shift_end) > new Date(d.shift_start), {
  path: ['shift_end'], message: 'Must be after the start time',
})

export const userCreateSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  role: z.enum(['admin', 'company']),
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().optional(),
  email: optionalEmail,
  phone: optionalPhone,
  password,
})

export const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().optional(),
  email: optionalEmail,
  phone: optionalPhone,
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: password,
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  path: ['confirm_password'], message: 'Passwords do not match',
})

export const setPasswordSchema = z.object({
  new_password: password,
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  path: ['confirm_password'], message: 'Passwords do not match',
})

export type LoginInput = z.infer<typeof loginSchema>
export type CompanyInput = z.infer<typeof companySchema>
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>
export type EmployeeEditInput = z.infer<typeof employeeEditSchema>
export type PassInput = z.infer<typeof passSchema>
export type WalkInInput = z.infer<typeof walkInSchema>
export type DeliveryInput = z.infer<typeof deliverySchema>
export type GateInput = z.infer<typeof gateSchema>
export type GuardCreateInput = z.infer<typeof guardCreateSchema>
export type GuardEditInput = z.infer<typeof guardEditSchema>
export type ShiftInput = z.infer<typeof shiftSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
export type ProfileInput = z.infer<typeof profileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type SetPasswordInput = z.infer<typeof setPasswordSchema>
