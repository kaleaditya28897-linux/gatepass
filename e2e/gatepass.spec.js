// Full building workflow through the real UI, one role after another:
// admin sets the building up -> employee invites a visitor and expects a delivery ->
// company admin approves -> visitor opens the pass link -> guard runs the gate.
//
// Needs an admin login:  E2E_ADMIN_USER / E2E_ADMIN_PASSWORD
import { test, expect } from '@playwright/test'

const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const PASSWORD = 'Plum-Kettle-4821!'
const NEW_PASSWORD = 'Rain-Lantern-7730!'
const run = Date.now().toString(36)
const names = {
  company: `E2E Works ${run}`,
  companyAdmin: `e2e_boss_${run}`,
  employee: `e2e_emp_${run}`,
  guard: `e2e_guard_${run}`,
  gate: `E2E Gate ${run}`,
  visitor: `Vera Visitor ${run}`,
  walkIn: `Walt Walkin ${run}`,
}
const state = {}

async function login(page, username, password) {
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

const dialog = (page) => page.getByRole('dialog')
const nav = (page, name) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true })
const row = (page, text) => page.getByRole('row').filter({ hasText: text })

/** Fail the test on CSP violations or uncaught page errors. */
function watchConsole(page) {
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text())
  })
  return problems
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  if (!ADMIN_PASSWORD) throw new Error('Set E2E_ADMIN_PASSWORD to the admin password of the stack under test.')
})

test('wrong password is rejected and signed-out users are sent to login', async ({ page }) => {
  await page.goto('/admin/companies')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Username').fill(ADMIN_USER)
  await page.getByLabel('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password')
  await expect(page).toHaveURL(/\/login/)
})

test('admin sets up a gate, a company with its admin, a guard and an employee', async ({ page }) => {
  const problems = watchConsole(page)
  await login(page, ADMIN_USER, ADMIN_PASSWORD)
  await expect(page.getByRole('heading', { name: 'Building Dashboard' })).toBeVisible()

  // Gate
  await nav(page, 'Gates').click()
  await page.getByRole('button', { name: 'Add Gate' }).click()
  await dialog(page).getByLabel('Name').fill(names.gate)
  await dialog(page).getByLabel('Code').fill(`E2E-${run}`.slice(0, 20))
  await dialog(page).getByRole('button', { name: 'Save gate' }).click()
  await expect(row(page, names.gate)).toBeVisible()

  // Company + its admin login, created together
  await nav(page, 'Companies').click()
  await page.getByRole('button', { name: 'Add Company' }).click()
  await dialog(page).getByLabel('Company name').fill(names.company)
  await expect(dialog(page).getByLabel('Short code')).toHaveValue(`e2e-works-${run}`)
  await dialog(page).getByLabel('Floor').fill('4th Floor')
  await dialog(page).getByLabel('Username').fill(names.companyAdmin)
  await dialog(page).getByLabel('Temporary password').fill(PASSWORD)
  await dialog(page).getByLabel('First name').fill('Bina')
  await dialog(page).getByRole('button', { name: 'Save company' }).click()
  await expect(row(page, names.company)).toContainText(names.companyAdmin)

  // A hard reload on a deep admin URL must still land in the app (not the Django admin).
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible()

  // Guard
  await nav(page, 'Guards').click()
  await page.getByRole('button', { name: 'Add Guard' }).click()
  await dialog(page).getByLabel('First name').fill('Gopal')
  await dialog(page).getByLabel('Username').fill(names.guard)
  await dialog(page).getByLabel('Temporary password').fill(PASSWORD)
  await dialog(page).getByLabel('Badge number').fill(`B-${run}`)
  await dialog(page).getByRole('button', { name: 'Add guard' }).click()
  await expect(row(page, names.guard)).toBeVisible()

  // Weak passwords are refused with a readable message, nothing is created.
  await nav(page, 'Employees').click()
  await page.getByRole('button', { name: 'Add Employee' }).click()
  await dialog(page).getByLabel('Company').selectOption({ label: names.company })
  await dialog(page).getByLabel('First name').fill('Esha')
  await dialog(page).getByLabel('Last name').fill('Employee')
  await dialog(page).getByLabel('Username').fill(names.employee)
  await dialog(page).getByLabel('Temporary password').fill('12345678')
  await dialog(page).getByLabel('Email').fill(`${names.employee}@example.com`)
  await dialog(page).getByLabel('Phone').fill('+919800000001')
  await dialog(page).getByRole('button', { name: 'Add employee' }).click()
  await expect(page.getByText(/password is (too common|entirely numeric)/i).first()).toBeVisible()
  await dialog(page).getByLabel('Temporary password').fill(PASSWORD)
  await dialog(page).getByRole('button', { name: 'Add employee' }).click()
  await expect(row(page, names.employee)).toContainText(names.company)

  expect(problems).toEqual([])
})

test('employee invites a visitor and registers a delivery', async ({ page }) => {
  await login(page, names.employee, PASSWORD)
  await expect(page).toHaveURL(/\/employee$/)

  await nav(page, 'My Passes').click()
  await page.getByRole('button', { name: 'New Pass' }).click()
  await dialog(page).getByLabel('Visitor name').fill(names.visitor)
  await dialog(page).getByLabel('Visitor phone').fill('+919811111111')
  await dialog(page).getByLabel('Purpose of visit').fill('Quarterly review')
  await dialog(page).getByRole('button', { name: 'Create pass' }).click()
  // Not approved yet: no QR code or link to share.
  await expect(dialog(page).getByText('Pending')).toBeVisible()
  await expect(dialog(page).getByAltText('Pass QR code')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(row(page, names.visitor)).toContainText('pending')

  await nav(page, 'Deliveries').click()
  await page.getByRole('button', { name: 'Add Delivery' }).click()
  await dialog(page).getByLabel('Platform / courier').fill(`Swiggy ${run}`)
  await dialog(page).getByLabel('Order ID').fill(`ORD-${run}`)
  await dialog(page).getByRole('button', { name: 'Add delivery' }).click()
  const otpCell = row(page, `Swiggy ${run}`).locator('span.font-mono')
  await expect(otpCell).toHaveText(/^\d{6}$/)
  state.otp = (await otpCell.textContent()).trim()

  // Employees cannot reach other roles' screens.
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/employee$/)
})

test('company admin approves the pass and gets a shareable link', async ({ page, context }) => {
  await login(page, names.companyAdmin, PASSWORD)
  await expect(page.getByRole('heading', { name: names.company })).toBeVisible()
  await nav(page, 'Passes').click()
  await row(page, names.visitor).getByRole('button', { name: /Approve pass/ }).click()
  await expect(row(page, names.visitor)).toContainText('approved')

  await row(page, names.visitor).getByRole('button', { name: /View pass/ }).click()
  await expect(dialog(page).getByAltText('Pass QR code')).toBeVisible()
  state.passUrl = await dialog(page).getByLabel('Pass link').inputValue()
  expect(state.passUrl).toMatch(/\/pass\/[0-9a-f-]{36}$/)

  // The visitor opens the link with no login at all.
  const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true })
  const visitorPage = await visitor.newPage()
  const problems = watchConsole(visitorPage)
  await visitorPage.goto(new URL(state.passUrl).pathname)
  await expect(visitorPage.getByRole('heading', { name: names.visitor })).toBeVisible()
  const qr = visitorPage.getByAltText('QR code for this pass')
  await expect(qr).toBeVisible()
  expect(await qr.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
  // The public page must not leak the visitor's phone number.
  await expect(visitorPage.getByText('+919811111111')).toHaveCount(0)
  expect(problems).toEqual([])
  await visitor.close()
})

test('guard checks the visitor in and out, handles a walk-in and a delivery', async ({ page }) => {
  const problems = watchConsole(page)
  await page.setViewportSize({ width: 390, height: 844 }) // a phone at the gate
  await login(page, names.guard, PASSWORD)
  await expect(page.getByRole('heading', { name: 'Gate Desk' })).toBeVisible()
  await page.getByLabel('You are at').selectOption({ label: names.gate })

  // Scan (typed code, as a hardware scanner or paste would produce)
  await page.getByRole('link', { name: 'Scan a pass' }).click()
  await page.getByLabel(/type \/ paste the pass code/).fill('not a pass')
  await page.getByRole('button', { name: 'Find' }).click()
  await expect(page.getByText(/not a GatePass code/).first()).toBeVisible()

  await page.getByLabel(/type \/ paste the pass code/).fill(state.passUrl)
  await page.getByRole('button', { name: 'Find' }).click()
  await expect(page.getByText(names.visitor)).toBeVisible()
  await expect(page.getByText('+919811111111')).toBeVisible() // guards do see contact details
  await page.getByRole('button', { name: 'Check in' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'checked in' }).first()).toBeVisible()

  // Scanning the same pass again offers check-out, not a second entry.
  await page.getByLabel(/type \/ paste the pass code/).fill(state.passUrl)
  await page.getByRole('button', { name: 'Find' }).click()
  await expect(page.getByRole('button', { name: /check out/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Check in' })).toHaveCount(0)

  // Walk-in
  await page.goto('/guard/walk-in')
  await page.getByLabel('Visitor name').fill(names.walkIn)
  await page.getByLabel('Visitor phone').fill('9822222222')
  await page.getByLabel('Visiting company').selectOption({ label: `${names.company} (4th Floor)` })
  await expect(page.getByLabel('Person they are meeting').getByRole('option', { name: /Esha Employee/ })).toBeAttached()
  await page.getByLabel('Person they are meeting').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Register and check in' }).click()
  await expect(page.getByRole('status').filter({ hasText: names.walkIn }).first()).toBeVisible()

  // Both are inside; check the walk-in out.
  await page.goto('/guard/active')
  await expect(row(page, names.visitor)).toBeVisible()
  await row(page, names.walkIn).getByRole('button', { name: 'Check out' }).click()
  await expect(row(page, names.walkIn)).toHaveCount(0)
  await expect(row(page, names.visitor)).toBeVisible()

  // Delivery: arrive, wrong OTP refused, right OTP releases.
  await page.goto('/guard/deliveries')
  const delivery = row(page, `Swiggy ${run}`)
  await expect(delivery).toBeVisible()
  await expect(page.getByText(state.otp)).toHaveCount(0) // the guard is never shown the OTP
  await delivery.getByRole('button', { name: 'Arrived' }).click()
  await dialog(page).getByLabel(/Delivery person's name/).fill(`Ravi Rider ${run}`)
  await dialog(page).getByRole('button', { name: 'Mark as arrived' }).click()
  await delivery.getByRole('button', { name: 'Enter OTP' }).click()
  const wrong = state.otp === '000000' ? '111111' : '000000'
  await dialog(page).getByLabel('6-digit OTP').fill(wrong)
  await dialog(page).getByRole('button', { name: 'Verify and release' }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('Invalid OTP')
  await dialog(page).getByLabel('6-digit OTP').fill(state.otp)
  await dialog(page).getByRole('button', { name: 'Verify and release' }).click()
  await expect(page.getByText('OTP correct. Hand over the delivery.').first()).toBeVisible()
  await expect(row(page, `Swiggy ${run}`)).toHaveCount(0)

  // Nothing overflows sideways on a phone.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  // Guards cannot open admin screens.
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/guard$/)
  expect(problems).toEqual([])
})

test('admin sees the day in the logs and can reset a password', async ({ page }) => {
  const problems = watchConsole(page)
  await login(page, ADMIN_USER, ADMIN_PASSWORD)

  await nav(page, 'Entries').click()
  await page.getByLabel('Search name, phone or company').fill(run)
  await expect(row(page, names.visitor)).toContainText('Inside')
  await expect(row(page, names.walkIn)).not.toContainText('Inside')
  await expect(row(page, `Ravi Rider ${run}`)).toContainText('delivery')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  expect((await download).suggestedFilename()).toMatch(/^gatepass-entries-.*\.csv$/)

  // Admin can force a check-out for a visitor the guard missed.
  await row(page, names.visitor).getByRole('button', { name: 'Check out' }).click()
  await dialog(page).getByRole('button', { name: 'Check out' }).click()
  await expect(row(page, names.visitor)).not.toContainText('Inside')

  await nav(page, 'Notifications').click()
  await expect(page.getByRole('row').filter({ hasText: 'has arrived at the gate' }).first()).toContainText('sent')

  await nav(page, 'Audit Logs').click()
  await page.getByLabel('Search descriptions').fill(names.visitor)
  await expect(page.getByRole('row').filter({ hasText: `Checked in visitor ${names.visitor}` })).toContainText('Visitor Checked In')

  await nav(page, 'Users').click()
  await page.getByLabel('Search name, username or email').fill(names.employee)
  await row(page, names.employee).getByRole('button', { name: /Reset password/ }).click()
  await dialog(page).getByLabel(/^New password/).fill(NEW_PASSWORD)
  await dialog(page).getByLabel('Confirm new password').fill(NEW_PASSWORD)
  await dialog(page).getByRole('button', { name: 'Set password' }).click()
  await expect(page.getByText(`Password for ${names.employee} updated.`).first()).toBeVisible()

  await nav(page, 'Dashboard').click()
  await expect(page.getByText('Entries per day (last 14 days)')).toBeVisible()
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible()
  expect(problems).toEqual([])
})

test('employee signs in with the reset password, changes it, and sees the visit finished', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill(names.employee)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password') // old password is dead

  await login(page, names.employee, NEW_PASSWORD)
  await page.getByRole('button', { name: /Esha Employee/ }).click()
  await page.getByRole('menuitem', { name: /Account/ }).click()
  await dialog(page).getByLabel('Current password').fill(NEW_PASSWORD)
  await dialog(page).getByLabel(/^New password/).fill(PASSWORD)
  await dialog(page).getByLabel('Confirm new password').fill(PASSWORD)
  await dialog(page).getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('Password changed.').first()).toBeVisible()

  await nav(page, 'My Passes').click()
  await expect(row(page, names.visitor)).toContainText('checked out')
  await nav(page, 'Deliveries').click()
  await expect(row(page, `Swiggy ${run}`)).toContainText('delivered')

  await page.getByRole('button', { name: /Esha Employee/ }).click()
  await page.getByRole('menuitem', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/login/)
  await login(page, names.employee, PASSWORD)
})
