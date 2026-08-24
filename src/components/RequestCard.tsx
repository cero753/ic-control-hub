import type { RequestRow, LedgerPayload } from '../lib/types'
import { FrameworkBadge, StatusBadge } from './ui'
import { buildLedgerXml, downloadXml } from '../lib/tallyXml'

function isLedgerPayload(p: unknown): p is LedgerPayload {
  return !!p && typeof p === 'object' && 'ledgerName' in (p as object)
}

export function PayloadDetails({ req }: { req: RequestRow }) {
  const p = req.payload as Record<string, unknown>
  const entries = Object.entries(p).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined,
  )
  if (entries.length === 0)
    return <p className="text-sm text-slate-400">No additional details.</p>
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-400">{humanize(k)}</dt>
          <dd className="text-slate-700">{String(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

export function RequestCard({
  req,
  children,
}: {
  req: RequestRow
  children?: React.ReactNode
}) {
  const control = req.controls
  const isLedger = control?.request_type === 'ledger' && isLedgerPayload(req.payload)

  function handleDownload() {
    if (!isLedgerPayload(req.payload)) return
    const xml = buildLedgerXml(req.payload)
    downloadXml(`${req.payload.ledgerName || 'ledger'}-tally.xml`, xml)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {control && <FrameworkBadge code={control.framework_code} />}
          <span className="font-mono text-xs text-slate-400">
            {req.control_id}
          </span>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <h3 className="font-semibold text-slate-900">{req.title}</h3>
      {control && (
        <p className="text-xs text-slate-500">{control.sub_area}</p>
      )}
      {req.requestor && (
        <p className="mt-0.5 text-xs text-slate-400">
          by {req.requestor.full_name ?? req.requestor.email}
        </p>
      )}

      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <PayloadDetails req={req} />
      </div>

      {req.approvals && req.approvals.length > 0 && (
        <div className="mt-3 space-y-1">
          {req.approvals.map((a) => (
            <div
              key={a.id}
              className={`rounded-md px-3 py-2 text-sm ${
                a.decision === 'approved'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-rose-50 text-rose-800'
              }`}
            >
              <span className="font-medium capitalize">{a.decision}</span> by{' '}
              {a.approver?.full_name ?? a.approver?.email ?? 'approver'}
              {a.comment ? ` — ${a.comment}` : ''}
            </div>
          ))}
        </div>
      )}

      {isLedger && req.status === 'approved' && (
        <button
          onClick={handleDownload}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
        >
          ⬇ Download Tally XML
        </button>
      )}

      {children}
    </div>
  )
}
