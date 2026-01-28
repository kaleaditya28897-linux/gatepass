import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useLogout } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Building2, Users, DoorOpen, Shield, Ticket, ClipboardList,
  Package, BarChart3, FileText, Menu, LogOut, User, ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const adminNav = [
  { label: 'Dashboard', href: '/admin', icon: BarChart3 },
  { label: 'Companies', href: '/admin/companies', icon: Building2 },
  { label: 'Employees', href: '/admin/employees', icon: Users },
  { label: 'Gates', href: '/admin/gates', icon: DoorOpen },
  { label: 'Guards', href: '/admin/guards', icon: Shield },
  { label: 'Passes', href: '/admin/passes', icon: Ticket },
  { label: 'Entries', href: '/admin/entries', icon: ClipboardList },
  { label: 'Deliveries', href: '/admin/deliveries', icon: Package },
  { label: 'Audit Logs', href: '/admin/audit', icon: FileText },
]

const companyNav = [
  { label: 'Dashboard', href: '/company', icon: BarChart3 },
  { label: 'Employees', href: '/company/employees', icon: Users },
  { label: 'Passes', href: '/company/passes', icon: Ticket },
  { label: 'Entries', href: '/company/entries', icon: ClipboardList },
  { label: 'Deliveries', href: '/company/deliveries', icon: Package },
]

const employeeNav = [
  { label: 'Dashboard', href: '/employee', icon: BarChart3 },
  { label: 'My Passes', href: '/employee/passes', icon: Ticket },
  { label: 'Deliveries', href: '/employee/deliveries', icon: Package },
]

const guardNav = [
  { label: 'Dashboard', href: '/guard', icon: BarChart3 },
  { label: 'Scan QR', href: '/guard/scan', icon: Ticket },
  { label: 'Active Visitors', href: '/guard/active', icon: Users },
  { label: 'Deliveries', href: '/guard/deliveries', icon: Package },
]

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const logout = useLogout()
  const location = useLocation()

  const nav = user?.role === 'admin' ? adminNav :
              user?.role === 'company' ? companyNav :
              user?.role === 'employee' ? employeeNav :
              guardNav

  return (
    <div className="min-h-screen flex">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        <div className="flex items-center justify-between h-16 px-4 border-b">
          {sidebarOpen && <span className="font-bold text-lg">GatePass</span>}
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {nav.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className={cn("flex-1 flex flex-col transition-all duration-300", sidebarOpen ? "ml-64" : "ml-16")}>
        <header className="h-16 border-b flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold">{user?.company?.name || 'GatePass'}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <User className="h-4 w-4" />
                {user?.first_name} {user?.last_name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground capitalize">{user?.role}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
