import type { ReactNode } from 'react'
import type { RequestRow, RequestStatus } from '../lib/types'
import {
  countByTab,
  ledgerPayloads,
  STATUS_TABS,
  type StatusTab,
} from '../lib/requestFilters'
import { buildLedgersXml } from '../lib/tallyXml'
import { downloadText } from '../lib/download'

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

/**
 * The status tab bar shared by My Requests, Approvals and the admin portal, so
 * all three agree on what each tab means (see matchesStatusTab).
 */
export function StatusTabs({
  requests,
  active,
  onSelect,
}: {
  requests: RequestRow[]
  active: StatusTab
  onSelect: (tab: StatusTab) => void
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {STATUS_TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            active === t.key
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label} ({countByTab(requests, t.key)})
        </button>
      ))}
    </div>
  )
}

/**
 * Downloads every approved ledger in `requests` as ONE Tally import file.
 * Renders nothing when there is nothing to export.
 */
export function TallyBundleButton({ requests }: { requests: RequestRow[] }) {
  const payloads = ledgerPayloads(requests)
  if (payloads.length === 0) return null

  return (
    <button
      onClick={() =>
        downloadText(
          `tally-ledgers-${payloads.length}.xml`,
          buildLedgersXml(payloads),
          'application/xml',
        )
      }
      className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
    >
      ⬇ Tally file ({payloads.length} ledger{payloads.length === 1 ? '' : 's'})
    </button>
  )
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
