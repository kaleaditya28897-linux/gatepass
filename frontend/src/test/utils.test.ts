import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { getErrorMessage } from '@/lib/errors'
import { extractPassCode, localInputToIso, titleCase, toLocalInput } from '@/utils/formatters'
import { changePasswordSchema, companySchema, passSchema, walkInSchema } from '@/utils/validators'

function apiError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('fail', 'ERR', config, {}, { status, data, statusText: '', headers: {}, config })
}

describe('getErrorMessage', () => {
  it('reads DRF detail and field errors', () => {
    expect(getErrorMessage(apiError(400, { detail: 'Pass has expired.' }))).toBe('Pass has expired.')
    expect(getErrorMessage(apiError(400, { visitor_phone: ['This field is required.'] }))).toBe('visitor phone: This field is required.')
    expect(getErrorMessage(apiError(400, { non_field_errors: ['Nope.'] }))).toBe('Nope.')
    expect(getErrorMessage(apiError(400, { admin_account: { password: ['Too short.'] } }))).toBe('password: Too short.')
  })

  it('never shows raw HTML or stack traces from server errors', () => {
    expect(getErrorMessage(apiError(500, '<html>Traceback…</html>'))).toMatch(/server ran into a problem/)
    expect(getErrorMessage(apiError(429, { detail: 'Request was throttled.' }))).toMatch(/Too many attempts/)
  })

  it('explains network failures', () => {
    expect(getErrorMessage(new AxiosError('Network Error'))).toMatch(/Cannot reach the server/)
    expect(getErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback')
  })
})

describe('extractPassCode', () => {
  const code = '3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d'
  it('accepts a pass URL, a bare code, and upper case', () => {
    expect(extractPassCode(`https://gate.example.com/pass/${code}`)).toBe(code)
    expect(extractPassCode(`  ${code.toUpperCase()} `)).toBe(code)
  })
  it('rejects anything else', () => {
    expect(extractPassCode('https://evil.example.com/login')).toBeNull()
    expect(extractPassCode('12345')).toBeNull()
  })
})

describe('date helpers', () => {
  it('round-trips a datetime-local value through ISO', () => {
    const local = '2026-11-21T09:30'
    expect(toLocalInput(new Date(localInputToIso(local)))).toBe(local)
    expect(localInputToIso(local)).toMatch(/Z$/)
  })
  it('title-cases status values', () => {
    expect(titleCase('checked_in')).toBe('Checked In')
  })
})

describe('validators', () => {
  const future = (hours: number) => toLocalInput(new Date(Date.now() + hours * 3600_000))
  const basePass = {
    visitor_name: 'A', visitor_phone: '+91 98765 43210', pass_type: 'pre_approved',
    valid_from: future(1), valid_until: future(3),
  }

  it('accepts a valid pass and rejects reversed or past validity', () => {
    expect(passSchema.safeParse(basePass).success).toBe(true)
    expect(passSchema.safeParse({ ...basePass, valid_until: future(0.5) }).success).toBe(false)
    expect(passSchema.safeParse({ ...basePass, valid_from: future(-5), valid_until: future(-1) }).success).toBe(false)
    expect(passSchema.safeParse({ ...basePass, visitor_phone: 'call me' }).success).toBe(false)
  })

  it('requires a company for walk-ins', () => {
    const result = walkInSchema.safeParse({ visitor_name: 'A', visitor_phone: '9876543210', host_company: '' })
    expect(result.success).toBe(false)
    expect(walkInSchema.safeParse({ visitor_name: 'A', visitor_phone: '9876543210', host_company: '3' }).success).toBe(true)
  })

  it('requires a full admin account when a username is given', () => {
    const company = { name: 'Acme', slug: 'acme', max_employees: 10, is_active: true }
    expect(companySchema.safeParse(company).success).toBe(true)
    expect(companySchema.safeParse({ ...company, admin_username: 'boss' }).success).toBe(false)
    expect(companySchema.safeParse({
      ...company, admin_username: 'boss', admin_first_name: 'B', admin_password: 'long-enough-1',
    }).success).toBe(true)
    expect(companySchema.safeParse({ ...company, slug: 'Bad Slug' }).success).toBe(false)
  })

  it('requires matching passwords', () => {
    const ok = { current_password: 'x', new_password: 'new-password-1', confirm_password: 'new-password-1' }
    expect(changePasswordSchema.safeParse(ok).success).toBe(true)
    expect(changePasswordSchema.safeParse({ ...ok, confirm_password: 'different' }).success).toBe(false)
  })
})
