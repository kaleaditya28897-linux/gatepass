import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/common/DataTable'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PublicPassPage } from '@/pages/PublicPassPage'
import { GuardDeliveriesPage } from '@/pages/guard/Deliveries'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/api/client'
import type { User } from '@/types'

function withProviders(ui: React.ReactElement, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const user = (role: User['role']): User => ({
  id: 1, username: 'u', email: '', first_name: 'U', last_name: '', role, phone: '', avatar: null,
})

beforeEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().logout()
})

describe('DataTable', () => {
  const columns: ColumnDef<{ name: string }>[] = [{ accessorKey: 'name', header: 'Name' }]

  it('shows an empty message and no stray "0" when there are no rows', () => {
    const { container } = render(<DataTable columns={columns} data={[]} pageCount={0} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/^0$|Nothing here0/)
    expect(screen.queryByText('Previous')).not.toBeInTheDocument()
  })

  it('paginates', () => {
    const onPageChange = vi.fn()
    render(<DataTable columns={columns} data={[{ name: 'Row' }]} pageCount={3} page={2} total={45} onPageChange={onPageChange} />)
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('45 records')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Next'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('shows load errors instead of an empty table', () => {
    render(<DataTable columns={columns} data={[]} error="Could not load this list." />)
    expect(screen.getByText('Could not load this list.')).toBeInTheDocument()
  })
})

describe('ProtectedRoute', () => {
  const tree = (
    <Routes>
      <Route path="/login" element={<div>login page</div>} />
      <Route path="/guard" element={<div>guard home</div>} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><div>admin home</div></ProtectedRoute>} />
    </Routes>
  )

  it('sends signed-out users to login', () => {
    withProviders(tree, '/admin')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('keeps other roles out of admin pages', () => {
    useAuthStore.getState().setAuth(user('guard'), 't', 'r')
    withProviders(tree, '/admin')
    expect(screen.getByText('guard home')).toBeInTheDocument()
    expect(screen.queryByText('admin home')).not.toBeInTheDocument()
  })

  it('lets the right role in', () => {
    useAuthStore.getState().setAuth(user('admin'), 't', 'r')
    withProviders(tree, '/admin')
    expect(screen.getByText('admin home')).toBeInTheDocument()
  })
})

describe('PublicPassPage', () => {
  const pass = {
    visitor_name: 'Nina Guest', visitor_company: '', host_company_name: 'Acme', host_employee_name: 'Asha Rao',
    qr_code_image: '/media/qr.png', pass_type: 'pre_approved', status: 'approved',
    valid_from: '2026-11-21T04:00:00Z', valid_until: '2026-11-21T08:00:00Z',
  }
  const page = <Routes><Route path="/pass/:code" element={<PublicPassPage />} /></Routes>

  it('shows the QR code for an approved pass', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: pass })
    withProviders(page, '/pass/abc')
    expect(await screen.findByText('Nina Guest')).toBeInTheDocument()
    expect(screen.getByAltText('QR code for this pass')).toBeInTheDocument()
    expect(screen.getByText(/Show this QR code to the guard/)).toBeInTheDocument()
  })

  it('hides the QR code and explains when the pass is not usable', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { ...pass, status: 'expired' } })
    withProviders(page, '/pass/abc')
    expect(await screen.findByText(/This pass has expired/)).toBeInTheDocument()
    expect(screen.queryByAltText('QR code for this pass')).not.toBeInTheDocument()
  })

  it('handles an unknown pass', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('404'))
    withProviders(page, '/pass/abc')
    expect(await screen.findByText('Pass not found')).toBeInTheDocument()
  })
})

describe('Guard deliveries', () => {
  const delivery = {
    id: 7, company_name: 'Acme', company_floor: '3rd', employee_name: 'Asha Rao', delivery_type: 'food_order',
    status: 'arrived', platform_name: 'Swiggy', order_id: 'S1', delivery_person_name: '', delivery_person_phone: '',
    expected_at: null, notes: '', otp_locked: false, created_at: '2026-11-21T04:00:00Z',
  }

  it('releases a delivery only through the OTP check and never shows the OTP', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('pending-gate')) return { data: { count: 1, next: null, previous: null, results: [delivery] } }
      if (url.includes('my-current')) return { status: 204, data: '' }
      return { data: { count: 1, results: [{ id: 2, name: 'Main Gate', location: '' }] } }
    })
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { verified: true, detail: 'ok' } })
    withProviders(<GuardDeliveriesPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Enter OTP/ }))
    const submit = screen.getByRole('button', { name: /Verify and release/ })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('6-digit OTP'), { target: { value: '12a34567' } })
    expect(screen.getByLabelText('6-digit OTP')).toHaveValue('123456')
    fireEvent.click(submit)

    await waitFor(() => expect(post).toHaveBeenCalledWith('/deliveries/7/verify-otp/', { otp: '123456' }))
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls.every(([url]) => !String(url).includes('delivered'))).toBe(true)
  })
})
