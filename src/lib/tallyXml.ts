import type { LedgerPayload } from './types'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Build a Tally-compatible XML import file for creating a Ledger master.
 * This matches Tally's "Masters" import envelope (Create action) so an approved
 * ledger request can be imported into Tally instead of re-keyed by hand.
 */
export function buildLedgerXml(payload: LedgerPayload): string {
  const name = escapeXml(payload.ledgerName || 'Unnamed Ledger')
  const parent = escapeXml(payload.parentGroup || 'Sundry Debtors')
  const amount = parseFloat(payload.openingBalance || '0') || 0
  // Tally convention: credit balances are negative in the ledger amount.
  const signed = payload.ledgerType === 'Cr' ? -Math.abs(amount) : Math.abs(amount)

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
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${name}" ACTION="Create">
            <NAME.LIST>
              <NAME>${name}</NAME>
            </NAME.LIST>
            <PARENT>${parent}</PARENT>
            <OPENINGBALANCE>${signed}</OPENINGBALANCE>
            <ISDEEMEDPOSITIVE>${payload.ledgerType === 'Cr' ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`
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
