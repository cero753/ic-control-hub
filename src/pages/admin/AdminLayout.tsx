import { NavLink, Outlet } from 'react-router-dom'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1 text-sm font-medium transition ${
    isActive
      ? 'bg-slate-800 text-white'
      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
  }`

export default function AdminLayout() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Full visibility across users, requests and the control framework.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1">
        <NavLink to="/admin" end className={tabClass}>
          Users
        </NavLink>
        <NavLink to="/admin/requests" className={tabClass}>
          All Requests
        </NavLink>
        <NavLink to="/admin/controls" className={tabClass}>
          All Controls
        </NavLink>
      </div>

      <Outlet />
    </div>
  )
}
