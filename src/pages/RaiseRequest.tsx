import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Control } from '../lib/types'
import { FrameworkBadge, Spinner } from '../components/ui'

const TALLY_GROUPS = [
  'Sundry Debtors',
  'Sundry Creditors',
  'Bank Accounts',
  'Cash-in-Hand',
  'Direct Expenses',
  'Indirect Expenses',
  'Direct Incomes',
  'Indirect Incomes',
  'Fixed Assets',
  'Current Assets',
  'Current Liabilities',
  'Duties & Taxes',
  'Loans (Liability)',
  'Capital Account',
]

export default function RaiseRequest() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [control, setControl] = useState<Control | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // shared
  const [title, setTitle] = useState('')
  // ledger fields
  const [ledgerName, setLedgerName] = useState('')
  const [parentGroup, setParentGroup] = useState(TALLY_GROUPS[0])
  const [openingBalance, setOpeningBalance] = useState('0')
  const [ledgerType, setLedgerType] = useState<'Dr' | 'Cr'>('Dr')
  // generic fields
  const [details, setDetails] = useState('')
  const [amount, setAmount] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [notes, setNotes] = useState('')

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

  if (loading) return <Spinner />
  if (error || !control)
    return (
      <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error ?? 'Control not found.'}
      </p>
    )

  const isLedger = control.request_type === 'ledger'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user || !control) return
    setBusy(true)
    setError(null)

    const payload = isLedger
      ? { ledgerName, parentGroup, openingBalance, ledgerType, notes }
      : { details, amount, effectiveDate, notes }

    const computedTitle =
      title.trim() ||
      (isLedger ? `Create ledger: ${ledgerName}` : `${control.sub_area} request`)

    const { error } = await supabase.from('requests').insert({
      control_id: control.id,
      requestor_id: session.user.id,
      title: computedTitle,
      payload,
      status: 'pending',
    })

    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/my-requests')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={`/controls/${control.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        ← Back to control
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FrameworkBadge code={control.framework_code} />
          <span className="font-mono text-xs text-slate-400">{control.id}</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {isLedger ? 'New Ledger Request' : 'Raise a Request'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{control.sub_area}</p>

        {isLedger && (
          <div className="mt-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            Once a finance approver signs off, you can download a Tally-ready XML
            and create the ledger in Tally.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <TextField
            label="Request title (optional)"
            value={title}
            onChange={setTitle}
            placeholder={
              isLedger ? 'e.g. Create ledger: Office Rent' : 'Short summary'
            }
          />

          {isLedger ? (
            <>
              <TextField
                label="Ledger name"
                value={ledgerName}
                onChange={setLedgerName}
                required
                placeholder="e.g. Office Rent - Bangalore"
              />
              <div>
                <Label>Parent group (Tally)</Label>
                <select
                  value={parentGroup}
                  onChange={(e) => setParentGroup(e.target.value)}
                  className={inputClass}
                >
                  {TALLY_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Opening balance"
                  value={openingBalance}
                  onChange={setOpeningBalance}
                  type="number"
                />
                <div>
                  <Label>Balance type</Label>
                  <select
                    value={ledgerType}
                    onChange={(e) =>
                      setLedgerType(e.target.value as 'Dr' | 'Cr')
                    }
                    className={inputClass}
                  >
                    <option value="Dr">Debit (Dr)</option>
                    <option value="Cr">Credit (Cr)</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Details / justification</Label>
                <textarea
                  required
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  placeholder="Describe what you are requesting and why it needs approval."
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Amount (optional)"
                  value={amount}
                  onChange={setAmount}
                  type="number"
                />
                <TextField
                  label="Effective date (optional)"
                  value={effectiveDate}
                  onChange={setEffectiveDate}
                  type="date"
                />
              </div>
            </>
          )}

          <div>
            <Label>Notes for approver (optional)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
            <Link
              to={`/controls/${control.id}`}
              className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-medium text-slate-700">
      {children}
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  )
}
