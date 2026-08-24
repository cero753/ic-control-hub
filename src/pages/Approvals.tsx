import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { RequestRow, RequestStatus } from '../lib/types'
import { Spinner } from '../components/ui'
import { RequestCard } from '../components/RequestCard'

const TABS: { key: RequestStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
]

export default function Approvals() {
  const { session } = useAuth()
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<RequestStatus | 'all'>('pending')
  const [comments, setComments] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
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

  async function decide(req: RequestRow, decision: 'approved' | 'rejected') {
    if (!session?.user) return
    setBusyId(req.id)
    setError(null)

    const { error: aErr } = await supabase.from('approvals').insert({
      request_id: req.id,
      approver_id: session.user.id,
      decision,
      comment: comments[req.id]?.trim() || null,
    })
    if (aErr) {
      setError(aErr.message)
      setBusyId(null)
      return
    }
    const { error: rErr } = await supabase
      .from('requests')
      .update({ status: decision, updated_at: new Date().toISOString() })
      .eq('id', req.id)
    setBusyId(null)
    if (rErr) setError(rErr.message)
    else {
      setComments((c) => ({ ...c, [req.id]: '' }))
      load()
    }
  }

  const filtered =
    tab === 'all' ? requests : requests.filter((r) => r.status === tab)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Approvals Inbox</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and decide on requests raised across all controls.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
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

      {error && (
        <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <Spinner label="Loading requests…" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-500">
          No {tab === 'all' ? '' : tab} requests.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((req) => (
            <RequestCard key={req.id} req={req}>
              {req.status === 'pending' && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <input
                    type="text"
                    placeholder="Comment (optional)"
                    value={comments[req.id] ?? ''}
                    onChange={(e) =>
                      setComments((c) => ({ ...c, [req.id]: e.target.value }))
                    }
                    className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(req, 'approved')}
                      disabled={busyId === req.id}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(req, 'rejected')}
                      disabled={busyId === req.id}
                      className="flex-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </RequestCard>
          ))}
        </div>
      )}
    </div>
  )
}
