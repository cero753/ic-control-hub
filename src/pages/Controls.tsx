import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Control } from '../lib/types'
import { FRAMEWORKS } from '../lib/types'
import { Badge, FrameworkBadge, Spinner } from '../components/ui'

export default function Controls() {
  const [controls, setControls] = useState<Control[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [framework, setFramework] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('controls')
      .select('*')
      .order('framework_code')
      .order('sno')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setControls((data as Control[]) ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return controls.filter((c) => {
      if (framework !== 'ALL' && c.framework_code !== framework) return false
      if (!q) return true
      return (
        c.sub_area.toLowerCase().includes(q) ||
        c.control_objective.toLowerCase().includes(q) ||
        c.control_description.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    })
  }, [controls, framework, search])

  if (loading) return <Spinner label="Loading controls…" />
  if (error)
    return (
      <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </p>
    )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Controls Library</h1>
        <p className="mt-1 text-sm text-slate-500">
          {controls.length} internal controls across 4 frameworks. Raise a
          request against any control that needs approval.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={framework === 'ALL'}
            onClick={() => setFramework('ALL')}
          >
            All ({controls.length})
          </FilterChip>
          {FRAMEWORKS.map((f) => (
            <FilterChip
              key={f.code}
              active={framework === f.code}
              onClick={() => setFramework(f.code)}
            >
              {f.code} ({controls.filter((c) => c.framework_code === f.code).length})
            </FilterChip>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search controls…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:w-64"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((c) => (
          <Link
            key={c.id}
            to={`/controls/${c.id}`}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FrameworkBadge code={c.framework_code} />
                <span className="text-xs font-mono text-slate-400">{c.id}</span>
              </div>
              <div className="flex gap-1">
                {c.key_control && <Badge color="purple">Key</Badge>}
                <Badge
                  color={c.control_type.toLowerCase().includes('detective') ? 'blue' : 'green'}
                >
                  {c.control_type}
                </Badge>
              </div>
            </div>
            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700">
              {c.sub_area}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
              {c.control_objective}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {c.manual_automated} · {c.frequency}
              </span>
              {c.requires_request && (
                <span className="text-xs font-medium text-indigo-600">
                  Request enabled →
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">
          No controls match your filters.
        </p>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
