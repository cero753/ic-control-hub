import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Badge } from './ui'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const isApprover = profile?.role === 'approver'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <NavLink to="/controls" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                IC
              </div>
              <span className="text-lg font-semibold text-slate-900">
                IC Control Hub
              </span>
            </NavLink>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/controls" className={linkClass}>
                Controls
              </NavLink>
              <NavLink to="/my-requests" className={linkClass}>
                My Requests
              </NavLink>
              {isApprover && (
                <NavLink to="/approvals" className={linkClass}>
                  Approvals
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-900">
                {profile?.full_name ?? profile?.email}
              </div>
              <div className="text-xs text-slate-500">
                <Badge color={isApprover ? 'purple' : 'slate'}>
                  {profile?.role ?? '—'}
                </Badge>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex items-center gap-1 border-t border-slate-100 px-4 py-2 sm:hidden">
          <NavLink to="/controls" className={linkClass}>
            Controls
          </NavLink>
          <NavLink to="/my-requests" className={linkClass}>
            My Requests
          </NavLink>
          {isApprover && (
            <NavLink to="/approvals" className={linkClass}>
              Approvals
            </NavLink>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
