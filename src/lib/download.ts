/** Trigger a browser download for generated text content (CSV, XML, …). */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  // A leading =, +, - or @ makes Excel treat the cell as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  // BOM so Excel opens UTF-8 (the control text contains ✓ and en-dashes).
  downloadText(filename, '﻿' + toCsv(headers, rows), 'text/csv;charset=utf-8')
}
