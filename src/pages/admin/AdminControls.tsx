import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ASSERTION_LABELS, FRAMEWORKS, type Control } from '../../lib/types'
import { AssertionCell, Badge, FrameworkBadge, Spinner } from '../../components/ui'
import { downloadCsv } from '../../lib/download'

export default function AdminControls() {
  const [controls, setControls] = useState<Control[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [framework, setFramework] = useState<string>('all')

  useEffect(() => {
    supabase
      .from('controls')
      .select('*')
      .order('id')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setControls((data as Control[]) ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(
    () =>
      framework === 'all'
        ? controls
        : controls.filter((c) => c.framework_code === framework),
    [controls, framework],
  )

  function exportCsv() {
    downloadCsv(
      'ic-control-hub-controls.csv',
      [
        'ID',
        'Framework',
        'S.No',
        'Sub-area',
        'Control objective',
        'Risk',
        'Key control',
        'Control description',
        ...ASSERTION_LABELS.map((a) => a.label),
        'Manual / Automated',
        'Frequency',
        'Control type',
        'Raisable as request',
      ],
      filtered.map((c) => [
        c.id,
        c.framework,
        c.sno,
        c.sub_area,
        c.control_objective,
        c.risk,
        c.key_control ? 'Yes' : 'No',
        c.control_description,
        ...ASSERTION_LABELS.map((a) => c.assertions?.[a.key] ?? ''),
        c.manual_automated,
        c.frequency,
        c.control_type,
        c.requires_request ? 'Yes' : 'No',
      ]),
    )
  }

  if (loading) return <Spinner label="Loading controls…" />
  if (error)
    return (
      <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </p>
    )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFramework('all')}
            className={chip(framework === 'all')}
          >
            All ({controls.length})
          </button>
          {FRAMEWORKS.map((f) => (
            <button
              key={f.code}
              onClick={() => setFramework(f.code)}
              className={chip(framework === f.code)}
            >
              {f.code} ({controls.filter((c) => c.framework_code === f.code).length})
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ⬇ Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Control</th>
              <th className="px-3 py-3">Sub-area</th>
              <th className="px-3 py-3">Objective</th>
              <th className="px-3 py-3">Risk</th>
              {ASSERTION_LABELS.map((a) => (
                <th key={a.key} className="px-2 py-3 text-center" title={a.label}>
                  {a.label.split(' ')[0].slice(0, 4)}
                </th>
              ))}
              <th className="px-3 py-3">Freq.</th>
              <th className="px-3 py-3">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <tr key={c.id} className="align-top hover:bg-slate-50">
                <td className="px-3 py-3 whitespace-nowrap">
                  <Link to={`/controls/${c.id}`} className="hover:underline">
                    <FrameworkBadge code={c.framework_code} />
                    <span className="ml-2 font-mono text-xs text-slate-500">
                      {c.id}
                    </span>
                  </Link>
                  {c.key_control && (
                    <div className="mt-1">
                      <Badge color="amber">Key</Badge>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 font-medium text-slate-900">
                  {c.sub_area}
                </td>
                <td className="max-w-xs px-3 py-3 text-slate-600">
                  {c.control_objective}
                </td>
                <td className="max-w-xs px-3 py-3 text-slate-600">{c.risk}</td>
                {ASSERTION_LABELS.map((a) => (
                  <td key={a.key} className="px-2 py-3 text-center">
                    <AssertionCell value={c.assertions?.[a.key] ?? ''} />
                  </td>
                ))}
                <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                  {c.frequency}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                  {c.control_type}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Assertion legend: <span className="font-semibold text-indigo-600">P</span>{' '}
        primary · <span className="font-semibold text-slate-400">X</span> not
        applicable · <span className="font-semibold text-emerald-600">✓</span>{' '}
        covered. Click a control ID for the full detail view.
      </p>
    </div>
  )
}

function chip(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm font-medium transition ${
    active
      ? 'bg-indigo-600 text-white'
      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
  }`
}
