import type { ReactNode } from 'react'
import type { RequestStatus } from '../lib/types'

const frameworkColors: Record<string, string> = {
  FSCR: 'bg-indigo-100 text-indigo-700',
  FA: 'bg-amber-100 text-amber-700',
  P2P: 'bg-emerald-100 text-emerald-700',
  R2R: 'bg-sky-100 text-sky-700',
}

export function FrameworkBadge({ code }: { code: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
        frameworkColors[code] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {code}
    </span>
  )
}

export function Badge({
  children,
  color = 'slate',
}: {
  children: ReactNode
  color?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'purple'
}) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-sky-100 text-sky-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${map[color]}`}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, { color: Parameters<typeof Badge>[0]['color']; label: string }> = {
    pending: { color: 'amber', label: 'Pending' },
    approved: { color: 'green', label: 'Approved' },
    rejected: { color: 'red', label: 'Rejected' },
    completed: { color: 'blue', label: 'Completed' },
  }
  const s = map[status]
  return <Badge color={s.color}>{s.label}</Badge>
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      <span>{label}</span>
    </div>
  )
}

export function AssertionCell({ value }: { value: string }) {
  const v = (value || '').trim()
  if (!v) return <span className="text-slate-300">—</span>
  if (v === '✓')
    return <span className="font-semibold text-emerald-600">✓</span>
  if (v.toUpperCase() === 'P')
    return <span className="font-semibold text-indigo-600">P</span>
  if (v.toUpperCase() === 'X')
    return <span className="font-semibold text-slate-400">X</span>
  return <span className="text-slate-600">{v}</span>
}
