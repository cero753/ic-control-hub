export type Role = 'requestor' | 'approver' | 'admin'

export const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: 'requestor',
    label: 'Requestor',
    description: 'Raises requests against controls and acts on them in Tally.',
  },
  {
    value: 'approver',
    label: 'Approver',
    description: 'Reviews and approves or rejects every request.',
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full access — manages users, roles and all request data.',
  },
]

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export interface Assertions {
  cutoff: string
  accuracy: string
  completeness: string
  existenceOccurrence: string
  rightsObligations: string
  valuationAllocation: string
  presentationDisclosure: string
}

export interface Control {
  id: string
  framework: string
  framework_code: string
  sno: number | null
  sub_area: string
  control_objective: string
  risk: string
  key_control: boolean
  control_description: string
  assertions: Assertions
  manual_automated: string
  frequency: string
  control_type: string
  requires_request: boolean
  request_type: 'ledger' | 'generic'
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: Role
  created_at: string
}

export interface LedgerPayload {
  ledgerName: string
  parentGroup: string
  openingBalance: string
  ledgerType: 'Dr' | 'Cr'
  notes: string
}

export interface GenericPayload {
  details: string
  amount?: string
  effectiveDate?: string
}

export interface RequestRow {
  id: string
  control_id: string
  requestor_id: string
  title: string
  payload: LedgerPayload | GenericPayload | Record<string, unknown>
  status: RequestStatus
  created_at: string
  updated_at: string
  // joined
  controls?: Control
  requestor?: Pick<Profile, 'full_name' | 'email'>
  approvals?: ApprovalRow[]
}

export interface ApprovalRow {
  id: string
  request_id: string
  approver_id: string
  decision: 'approved' | 'rejected'
  comment: string | null
  decided_at: string
  approver?: Pick<Profile, 'full_name' | 'email'>
}

export const ASSERTION_LABELS: { key: keyof Assertions; label: string }[] = [
  { key: 'cutoff', label: 'Cut-off procedure' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'existenceOccurrence', label: 'Existence & Occurrence' },
  { key: 'rightsObligations', label: 'Rights & Obligations' },
  { key: 'valuationAllocation', label: 'Valuation & Allocation' },
  { key: 'presentationDisclosure', label: 'Presentation & Disclosure' },
]

export const FRAMEWORKS = [
  { code: 'FSCR', name: 'Financial Statement Closing & Reporting' },
  { code: 'FA', name: 'Fixed Assets' },
  { code: 'P2P', name: 'Procure to Pay' },
  { code: 'R2R', name: 'Record to Report' },
]
