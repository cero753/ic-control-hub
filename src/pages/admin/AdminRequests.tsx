import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { RequestRow, RequestStatus } from '../../lib/types'
import { Spinner } from '../../components/ui'
import { RequestCard } from '../../components/RequestCard'
import { downloadCsv, downloadText } from '../../lib/download'
import { buildLedgerXml } from '../../lib/tallyXml'

const TABS: { key: RequestStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'completed', label: 'Completed' },
]

export default function AdminRequests() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<RequestStatus | 'all'>('all')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('requests')
      .select(
        '*, controls(*), requestor:profiles!requests_requestor_id_fkey(full_name, email), approvals(*, approver:profiles(full_name, email))',
      )
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRequests((data as RequestRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return requests
      .filter((r) => tab === 'all' || r.status === tab)
      .filter((r) => {
        if (!needle) return true
        const hay = [
          r.title,
          r.control_id,
          r.controls?.sub_area,
          r.requestor?.full_name,
          r.requestor?.email,
          JSON.stringify(r.payload),
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
  }, [requests, tab, q])

  function exportCsv() {
    downloadCsv(
      'ic-control-hub-requests.csv',
      [
        'Request ID',
        'Control',
        'Framework',
        'Sub-area',
        'Title',
        'Requestor',
        'Requestor email',
        'Status',
        'Raised on',
        'Decision',
        'Decided by',
        'Comment',
        'Payload',
      ],
      filtered.map((r) => {
        const decision = r.approvals?.[0]
        return [
          r.id,
          r.control_id,
          r.controls?.framework_code,
          r.controls?.sub_area,
          r.title,
          r.requestor?.full_name,
          r.requestor?.email,
          r.status,
          new Date(r.created_at).toISOString(),
          decision?.decision ?? '',
          decision?.approver?.full_name ?? decision?.approver?.email ?? '',
          decision?.comment ?? '',
          JSON.stringify(r.payload),
        ]
      }),
    )
  }

  // Every approved ledger request in one file — Tally accepts many LEDGER blocks
  // per envelope, but concatenating envelopes is not valid, so emit them
  // individually as a simple bundle the admin can import one at a time.
  const ledgerReady = filtered.filter(
    (r) =>
      r.controls?.request_type === 'ledger' &&
      (r.status === 'approved' || r.status === 'completed') &&
      !!(r.payload as { ledgerName?: string }).ledgerName,
  )

  function exportAllXml() {
    ledgerReady.forEach((r, i) => {
      const p = r.payload as Parameters<typeof buildLedgerXml>[0]
      // Stagger the clicks; browsers drop rapid-fire programmatic downloads.
      setTimeout(() => {
        downloadText(
          `${p.ledgerName || 'ledger'}-tally.xml`,
          buildLedgerXml(p),
          'application/xml',
        )
      }, i * 300)
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const count =
              t.key === 'all'
                ? requests.length
                : requests.filter((r) => r.status === t.key).length
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  tab === t.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label} ({count})
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={exportAllXml}
            disabled={ledgerReady.length === 0}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            ⬇ Tally XML ({ledgerReady.length})
          </button>
        </div>
      </div>

      <input
        type="search"
        aria-label="Search requests"
        placeholder="Search by title, control, requestor…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />

      {error && (
        <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <Spinner label="Loading requests…" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-500">
          No requests match this filter.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((req) => (
            <RequestCard key={req.id} req={req} />
          ))}
        </div>
      )}
    </div>
  )
}
