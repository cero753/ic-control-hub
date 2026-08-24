import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'

const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173'
const PW = 'Passw0rd!'
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.log('  ✗ FAIL:', m) } }

const { createClient: mkClient } = await import('@supabase/supabase-js')
const rq = mkClient(url, anon, { auth: { persistSession: false } })
const ap = mkClient(url, anon, { auth: { persistSession: false } })
const { data: rqa } = await rq.auth.signInWithPassword({ email: 'requestor@ichub.com', password: PW })
const { data: apa } = await ap.auth.signInWithPassword({ email: 'approver@ichub.com', password: PW })

// Cr ledger with special chars in name to test XML escaping
const crName = `Cr Test <Rent> & "Co" ${String(Date.now()).slice(-5)}`
const { data: creq } = await rq.from('requests').insert({
  control_id: 'FSCR-01', requestor_id: rqa.user.id, title: `Cr XML ${crName}`,
  payload: { ledgerName: crName, parentGroup: 'Sundry Creditors', openingBalance: '3200', ledgerType: 'Cr', notes: '' },
  status: 'pending',
}).select().single()
await ap.from('approvals').insert({ request_id: creq.id, approver_id: apa.user.id, decision: 'approved', comment: 'ok' })
await ap.from('requests').update({ status: 'approved' }).eq('id', creq.id)

const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.fill('input[type=email]', 'requestor@ichub.com')
await page.fill('input[type=password]', PW)
await page.click('button[type=submit]')
await page.waitForURL('**/controls', { timeout: 15000 })
await page.goto(`${BASE}/my-requests`, { waitUntil: 'networkidle' })
await page.waitForFunction((t) => document.querySelector('main')?.innerText.includes(t), `Cr XML`, { timeout: 10000 })
const card = page.locator('div.rounded-xl.border').filter({ hasText: 'Cr XML' }).first()
const [dl] = await Promise.all([
  page.waitForEvent('download'),
  card.getByRole('button', { name: /Download Tally XML/i }).click(),
])
const xml = await readFile(await dl.path(), 'utf-8')
console.log('--- XML sample ---\n' + xml.split('\n').slice(0, 40).join('\n'))

ok(/<OPENINGBALANCE>-3200<\/OPENINGBALANCE>/.test(xml), 'Cr opening balance is negative (-3200)')
ok(xml.includes('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>'), 'Cr isdeemedpositive=No')
ok(xml.includes('<PARENT>Sundry Creditors</PARENT>'), 'Cr parent group correct')
ok(xml.includes('&lt;Rent&gt;') && xml.includes('&amp;') && xml.includes('&quot;Co&quot;'), 'special chars escaped (<, &, ")')
ok(!/<Rent>|&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml.replace(/<\/?[A-Z][^>]*>/g, '')), 'no raw unescaped < or & in text nodes')

// cleanup
await rq.from('requests').delete().eq('id', creq.id)
await browser.close()
console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
