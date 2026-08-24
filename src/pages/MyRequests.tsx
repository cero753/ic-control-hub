import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { RequestRow } from '../lib/types'
import { Spinner } from '../components/ui'
import { RequestCard } from '../components/RequestCard'

export default function MyRequests() {
  const { session } = useAuth()
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session?.user) return
    const { data, error } = await supabase
      .from('requests')
      .select('*, controls(*), approvals(*, approver:profiles(full_name, email))')
      .eq('requestor_id', session.user.id)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRequests((data as RequestRow[]) ?? [])
    setLoading(false)
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  async function markCompleted(id: string) {
    const { error } = await supabase
      .from('requests')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  if (loading) return <Spinner label="Loading your requests…" />

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Requests you have raised and their approval status.
          </p>
        </div>
        <Link
          to="/controls"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + New request
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <p className="text-slate-500">You haven't raised any requests yet.</p>
          <Link
            to="/controls"
            className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            Browse controls to raise your first request →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {requests.map((req) => (
            <RequestCard key={req.id} req={req}>
              {req.status === 'approved' && (
                <button
                  onClick={() => markCompleted(req.id)}
                  className="mt-3 ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ✓ Mark created in Tally
                </button>
              )}
            </RequestCard>
          ))}
        </div>
      )}
    </div>
  )
}
