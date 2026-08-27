import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { RequestRow } from '../../lib/types'
import { Spinner, StatusTabs, TallyBundleButton } from '../../components/ui'
import { matchesStatusTab, type StatusTab } from '../../lib/requestFilters'
import { RequestCard } from '../../components/RequestCard'
import { downloadCsv } from '../../lib/download'

export default function AdminRequests() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<StatusTab>('all')
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
      .filter((r) => matchesStatusTab(r, tab))
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          ⬇ Export CSV
        </button>
        {/* One consolidated import file for every approved ledger below. */}
        <TallyBundleButton requests={filtered} />
      </div>

      <StatusTabs requests={requests} active={tab} onSelect={setTab} />

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
