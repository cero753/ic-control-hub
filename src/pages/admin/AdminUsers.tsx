import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ROLES, type Profile, type Role } from '../../lib/types'
import { Badge, Spinner } from '../../components/ui'

function roleColor(role: Role) {
  return role === 'admin' ? 'red' : role === 'approver' ? 'purple' : 'slate'
}

export default function AdminUsers() {
  const { profile: me, refreshProfile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showDeactivated, setShowDeactivated] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setUsers((data as Profile[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function changeRole(user: Profile, role: Role) {
    if (role === user.role) return
    setBusyId(user.id)
    setError(null)
    setInfo(null)
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id)
    setBusyId(null)
    if (error) {
      setError(error.message)
      return
    }
    setInfo(`${user.full_name ?? user.email} is now a ${role}.`)
    // If admins change their own role the header badge and nav must follow.
    if (user.id === me?.id) await refreshProfile()
    load()
  }

  /**
   * Withdraw or restore access. Deliberately not a delete: profiles cascade to
   * requests and approvals, so removing a user would erase the history of every
   * request they raised and every approval they signed.
   */
  async function setActive(user: Profile, active: boolean) {
    const who = user.full_name ?? user.email
    if (
      !active &&
      !window.confirm(
        `Deactivate ${who}? They will be signed out and blocked from signing in. ` +
          `Their requests and approvals are kept, and you can reactivate them later.`,
      )
    )
      return

    setBusyId(user.id)
    setError(null)
    setInfo(null)
    const { error } = await supabase.rpc('admin_set_user_active', {
      p_user_id: user.id,
      p_active: active,
    })
    setBusyId(null)
    if (error) {
      setError(error.message)
      return
    }
    setInfo(`${who} has been ${active ? 'reactivated' : 'deactivated'}.`)
    load()
  }

  const visible = showDeactivated
    ? users
    : users.filter((u) => !u.deactivated_at)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <span key={r.value} className="text-xs text-slate-500">
              <Badge color={roleColor(r.value)}>{r.label}</Badge>{' '}
              {visible.filter((u) => u.role === r.value).length}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowDeactivated((s) => !s)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {showDeactivated ? 'Active only' : 'Show deactivated'}
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : '+ Add account'}
          </button>
        </div>
      </div>

      {showForm && (
        <CreateAccountForm
          onCreated={(msg) => {
            setInfo(msg)
            setShowForm(false)
            load()
          }}
        />
      )}

      {error && (
        <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {info && (
        <p className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </p>
      )}

      {loading ? (
        <Spinner label="Loading users…" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Current role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Change role</th>
                <th className="px-4 py-3">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((u) => {
                const inactive = !!u.deactivated_at
                return (
                  <tr
                    key={u.id}
                    className={inactive ? 'bg-slate-50/60' : 'hover:bg-slate-50'}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.full_name ?? '—'}
                      {u.id === me?.id && (
                        <span className="ml-2 text-xs text-slate-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge color={roleColor(u.role)}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {inactive ? (
                        <Badge color="slate">Deactivated</Badge>
                      ) : (
                        <Badge color="green">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Role for ${u.email}`}
                        value={u.role}
                        // A deactivated user cannot sign in, so granting them a
                        // role would be misleading. Reactivate first.
                        disabled={busyId === u.id || inactive}
                        onChange={(e) => changeRole(u, e.target.value as Role)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        aria-label={`${inactive ? 'Reactivate' : 'Deactivate'} ${u.email}`}
                        onClick={() => setActive(u, inactive)}
                        disabled={busyId === u.id || u.id === me?.id}
                        title={
                          u.id === me?.id
                            ? 'You cannot deactivate your own account'
                            : undefined
                        }
                        className={`rounded-lg px-3 py-1 text-sm font-medium disabled:opacity-40 ${
                          inactive
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border border-rose-300 text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        {inactive ? 'Reactivate' : 'Deactivate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-1 text-xs text-slate-500">
        {ROLES.map((r) => (
          <p key={r.value}>
            <span className="font-semibold text-slate-700">{r.label}</span> —{' '}
            {r.description}
          </p>
        ))}
      </div>
    </div>
  )
}

function CreateAccountForm({ onCreated }: { onCreated: (msg: string) => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('requestor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // Role-bearing account creation goes through admin_create_user, a SECURITY
    // DEFINER function that re-checks is_admin() server-side. Plain signUp always
    // produces a requestor, by design.
    const { error } = await supabase.rpc('admin_create_user', {
      p_email: email,
      p_password: password,
      p_full_name: fullName,
      p_role: role,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    onCreated(`Account created for ${email} as ${role}.`)
    setFullName('')
    setEmail('')
    setPassword('')
    setRole('requestor')
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="mb-3 font-semibold text-slate-900">New account</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="new-full-name"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Full name
          </label>
          <input
            id="new-full-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label
            htmlFor="new-email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="new-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label
            htmlFor="new-password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Temporary password
          </label>
          <input
            id="new-password"
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            At least 8 characters. Share it with the user to sign in.
          </p>
        </div>
        <div>
          <label
            htmlFor="new-role"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Role
          </label>
          <select
            id="new-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}
