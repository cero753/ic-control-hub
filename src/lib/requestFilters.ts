import type { LedgerPayload, RequestRow, RequestStatus } from './types'

export type StatusTab = RequestStatus | 'all'

export const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'completed', label: 'Completed' },
]

/**
 * Which requests a status tab shows.
 *
 * "Approved" deliberately includes `completed`: marking a request created in
 * Tally does not un-approve it, and it used to vanish from the Approved tab the
 * moment someone acted on it. Completed keeps its own tab as a narrower view.
 *
 * Every portal filters through this one function so the rule cannot drift.
 */
export function matchesStatusTab(req: RequestRow, tab: StatusTab): boolean {
  if (tab === 'all') return true
  if (tab === 'approved') return req.status === 'approved' || req.status === 'completed'
  return req.status === tab
}

export function countByTab(requests: RequestRow[], tab: StatusTab): number {
  return requests.filter((r) => matchesStatusTab(r, tab)).length
}

/**
 * The requests that can go into a Tally import file: ledger-type controls that
 * cleared approval and actually name a ledger.
 *
 * `completed` is included for the same reason as above — the consolidated file
 * has to stay available after "Mark created in Tally", e.g. to re-import into a
 * fresh company or to prove what was sent.
 */
export function ledgerReadyRequests(requests: RequestRow[]): RequestRow[] {
  return requests.filter(
    (r) =>
      r.controls?.request_type === 'ledger' &&
      (r.status === 'approved' || r.status === 'completed') &&
      !!(r.payload as Partial<LedgerPayload>).ledgerName,
  )
}

export function ledgerPayloads(requests: RequestRow[]): LedgerPayload[] {
  return ledgerReadyRequests(requests).map((r) => r.payload as LedgerPayload)
}
