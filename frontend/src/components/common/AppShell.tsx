import { useEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useLogout } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Building2, Users, DoorOpen, Shield, Ticket, ClipboardList, Package, BarChart3, FileText,
  Menu, LogOut, User, ChevronLeft, ScanLine, UserPlus, CalendarClock, UserCog, Bell, Settings,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AccountDialog } from './AccountDialog'

interface NavItem { label: string; href: string; icon: LucideIcon }

const NAV: Record<string, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin', icon: BarChart3 },
    { label: 'Companies', href: '/admin/companies', icon: Building2 },
    { label: 'Employees', href: '/admin/employees', icon: Users },
    { label: 'Gates', href: '/admin/gates', icon: DoorOpen },
    { label: 'Guards', href: '/admin/guards', icon: Shield },
    { label: 'Shifts', href: '/admin/shifts', icon: CalendarClock },
    { label: 'Passes', href: '/admin/passes', icon: Ticket },
    { label: 'Entries', href: '/admin/entries', icon: ClipboardList },
    { label: 'Deliveries', href: '/admin/deliveries', icon: Package },
    { label: 'Users', href: '/admin/users', icon: UserCog },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    { label: 'Audit Logs', href: '/admin/audit', icon: FileText },
  ],
  company: [
    { label: 'Dashboard', href: '/company', icon: BarChart3 },
    { label: 'Employees', href: '/company/employees', icon: Users },
    { label: 'Passes', href: '/company/passes', icon: Ticket },
    { label: 'Entries', href: '/company/entries', icon: ClipboardList },
    { label: 'Deliveries', href: '/company/deliveries', icon: Package },
  ],
  employee: [
    { label: 'Dashboard', href: '/employee', icon: BarChart3 },
    { label: 'My Passes', href: '/employee/passes', icon: Ticket },
    { label: 'Deliveries', href: '/employee/deliveries', icon: Package },
  ],
  guard: [
    { label: 'Dashboard', href: '/guard', icon: BarChart3 },
    { label: 'Scan Pass', href: '/guard/scan', icon: ScanLine },
    { label: 'Walk-in', href: '/guard/walk-in', icon: UserPlus },
    { label: 'Inside Now', href: '/guard/active', icon: Users },
    { label: 'Deliveries', href: '/guard/deliveries', icon: Package },
  ],
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()
  const [accountOpen, setAccountOpen] = useState(false)
  const logout = useLogout()
  const location = useLocation()
  const nav = NAV[user?.role ?? 'guard'] ?? NAV.guard

  // On phones the menu is an overlay: start closed and close after navigating.
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setSidebarOpen(false)
  }, [location.pathname, setSidebarOpen])

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username

  return (
    <div className="min-h-screen flex bg-muted/30">
      {sidebarOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-200',
          sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-16 md:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between h-14 px-3 border-b">
          {sidebarOpen && <span className="font-bold text-lg px-1">GatePass</span>}
          <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle menu">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Main">
          {nav.map((item) => {
            const Icon = item.icon
            const isRoot = item.href.split('/').length === 2
            const isActive = isRoot
              ? location.pathname === item.href
              : location.pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className={cn('flex-1 flex flex-col min-w-0 transition-all duration-200', sidebarOpen ? 'md:ml-64' : 'md:ml-16')}>
        <header className="sticky top-0 z-30 h-14 border-b bg-card flex items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-base font-semibold truncate">{user?.company?.name || 'GatePass'}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 max-w-[60vw]">
                <User className="h-4 w-4" />
                <span className="truncate">{fullName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.username}</DropdownMenuLabel>
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground capitalize">
                {user?.role === 'company' ? 'Company admin' : user?.role}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAccountOpen(true)}>
                <Settings className="h-4 w-4 mr-2" /> Account &amp; password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  )
}
