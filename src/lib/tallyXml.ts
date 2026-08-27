import type { LedgerPayload } from './types'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** One <TALLYMESSAGE> block: the ledger master itself, without the envelope. */
function ledgerMessage(payload: LedgerPayload): string {
  const name = escapeXml(payload.ledgerName || 'Unnamed Ledger')
  const parent = escapeXml(payload.parentGroup || 'Sundry Debtors')
  const amount = parseFloat(payload.openingBalance || '0') || 0
  // Tally convention: credit balances are negative in the ledger amount.
  const signed = payload.ledgerType === 'Cr' ? -Math.abs(amount) : Math.abs(amount)

  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${name}" ACTION="Create">
            <NAME.LIST>
              <NAME>${name}</NAME>
            </NAME.LIST>
            <PARENT>${parent}</PARENT>
            <OPENINGBALANCE>${signed}</OPENINGBALANCE>
            <ISDEEMEDPOSITIVE>${payload.ledgerType === 'Cr' ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
          </LEDGER>
        </TALLYMESSAGE>`
}

/**
 * Build one Tally "All Masters" import file creating every given ledger.
 *
 * Tally accepts many <TALLYMESSAGE> blocks inside a single <REQUESTDATA>, so a
 * whole batch of approved ledger requests imports in one pass. Concatenating
 * several <ENVELOPE> documents would NOT be valid XML, which is why the bundle
 * is built here rather than by joining single-ledger files.
 */
export function buildLedgersXml(payloads: LedgerPayload[]): string {
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
${payloads.map(ledgerMessage).join('\n')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
}

/**
 * Build a Tally-compatible XML import file for creating a single Ledger master,
 * so an approved ledger request can be imported instead of re-keyed by hand.
 */
export function buildLedgerXml(payload: LedgerPayload): string {
  return buildLedgersXml([payload])
}

export function downloadXml(filename: string, xml: string): void {
  const blob = new Blob([xml], { type: 'application/xml' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
