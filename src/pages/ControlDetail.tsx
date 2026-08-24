import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Control } from '../lib/types'
import { ASSERTION_LABELS } from '../lib/types'
import { AssertionCell, Badge, FrameworkBadge, Spinner } from '../components/ui'

export default function ControlDetail() {
  const { id } = useParams<{ id: string }>()
  const [control, setControl] = useState<Control | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('controls')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setControl(data as Control)
        setLoading(false)
      })
  }, [id])

  if (loading) return <Spinner label="Loading control…" />
  if (error || !control)
    return (
      <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error ?? 'Control not found.'}
      </p>
    )

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/controls"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        ← Back to controls
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <FrameworkBadge code={control.framework_code} />
            <span className="font-mono text-xs text-slate-400">
              {control.id}
            </span>
            {control.key_control && <Badge color="purple">Key control</Badge>}
            <Badge
              color={
                control.control_type.toLowerCase().includes('detective')
                  ? 'blue'
                  : 'green'
              }
            >
              {control.control_type}
            </Badge>
            <Badge color="slate">{control.manual_automated}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {control.sub_area}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{control.framework}</p>

          {control.requires_request && (
            <Link
              to={`/controls/${control.id}/request`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {control.request_type === 'ledger'
                ? 'Raise ledger creation request'
                : 'Raise a request'}
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <Field label="Control Objective" value={control.control_objective} />
          <Field label="Risk — What can go wrong?" value={control.risk} />
          <Field
            label="Control Description"
            value={control.control_description}
            full
          />
          <Field label="Frequency" value={control.frequency} />
          <Field label="Manual / Automated" value={control.manual_automated} />
        </div>

        <div className="border-t border-slate-100 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Financial Statement Assertions
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {ASSERTION_LABELS.map((a, i) => (
                  <tr
                    key={a.key}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                  >
                    <td className="px-4 py-2 text-slate-700">{a.label}</td>
                    <td className="w-16 px-4 py-2 text-center">
                      <AssertionCell value={control.assertions[a.key]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Legend: <span className="font-semibold text-indigo-600">P</span> =
            Preventive / primary ·{' '}
            <span className="font-semibold text-slate-400">X</span> = relevant ·{' '}
            <span className="font-semibold text-emerald-600">✓</span> =
            applicable · — = not marked
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  full = false,
}: {
  label: string
  value: string
  full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <p className="whitespace-pre-line text-sm text-slate-700">
        {value || '—'}
      </p>
    </div>
  )
}
