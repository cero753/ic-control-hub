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

const stamp = String(Date.now()).slice(-5)

async function raiseApproved(payload, title) {
  const { data: req } = await rq.from('requests').insert({
    control_id: 'FSCR-01', requestor_id: rqa.user.id, title,
    payload, status: 'pending',
  }).select().single()
  await ap.from('approvals').insert({ request_id: req.id, approver_id: apa.user.id, decision: 'approved', comment: 'ok' })
  await ap.from('requests').update({ status: 'approved' }).eq('id', req.id)
  return req
}

// Cr ledger with special chars in name to test XML escaping
const crName = `Cr Test <Rent> & "Co" ${stamp}`
const creq = await raiseApproved(
  { ledgerName: crName, parentGroup: 'Sundry Creditors', openingBalance: '3200', ledgerType: 'Cr', notes: '' },
  `Cr XML ${crName}`,
)
// A second, Dr ledger so the consolidated file has more than one master in it.
const drName = `Dr Test Bundle ${stamp}`
const dreq = await raiseApproved(
  { ledgerName: drName, parentGroup: 'Bank Accounts', openingBalance: '1500.75', ledgerType: 'Dr', notes: '' },
  `Dr XML ${drName}`,
)

const browser = await chromium.launch()
const ctx = await browser.newContext({ acceptDownloads: true })
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.fill('input[type=email]', 'requestor@ichub.com')
await page.fill('input[type=password]', PW)
await page.click('button[type=submit]')
await page.waitForURL('**/controls', { timeout: 15000 })
await page.goto(`${BASE}/my-requests`, { waitUntil: 'networkidle' })
await page.waitForFunction((t) => document.querySelector('main')?.innerText.includes(t), `Cr XML`, { timeout: 10000 })

// ---- single-ledger download (per request card) ----
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
ok((xml.match(/<TALLYMESSAGE/g) || []).length === 1, 'single-request file holds exactly one TALLYMESSAGE')

// ---- consolidated download (all approved ledgers in one file) ----
const bundleBtn = page.getByRole('button', { name: /Tally file \(\d+ ledgers?\)/i })
ok(await bundleBtn.count() > 0, 'consolidated Tally file button is present for the requestor')

async function downloadBundle() {
  const [d] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Tally file \(\d+ ledgers?\)/i }).first().click(),
  ])
  return readFile(await d.path(), 'utf-8')
}

const bundle = await downloadBundle()
const msgCount = (bundle.match(/<TALLYMESSAGE/g) || []).length
ok((bundle.match(/<ENVELOPE>/g) || []).length === 1, 'consolidated file is ONE envelope, not concatenated envelopes')
ok((bundle.match(/<\/ENVELOPE>/g) || []).length === 1, 'consolidated file has one closing envelope')
ok((bundle.match(/<REQUESTDATA>/g) || []).length === 1, 'consolidated file has a single REQUESTDATA block')
ok(msgCount >= 2, `consolidated file holds every approved ledger (${msgCount} TALLYMESSAGE blocks)`)
ok(bundle.includes(drName), 'consolidated file contains the Dr ledger')
ok(bundle.includes('&lt;Rent&gt;'), 'consolidated file contains the Cr ledger, still escaped')
ok(/<OPENINGBALANCE>-3200<\/OPENINGBALANCE>/.test(bundle), 'Cr row still negative inside the bundle')
ok(/<OPENINGBALANCE>1500\.75<\/OPENINGBALANCE>/.test(bundle), 'Dr row is positive inside the bundle')
ok(
  (bundle.match(/<ISDEEMEDPOSITIVE>Yes<\/ISDEEMEDPOSITIVE>/g) || []).length >= 1 &&
  (bundle.match(/<ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE>/g) || []).length >= 1,
  'Dr/Cr signing is applied per ledger, not per file',
)

// ---- the file must survive "Mark created in Tally" ----
const drCard = page.locator('div.rounded-xl.border').filter({ hasText: `Dr XML ${drName}` }).first()
await drCard.getByRole('button', { name: /Mark created in Tally/i }).click()
await page.waitForFunction(
  (t) => (document.querySelector('main')?.innerText || '').includes(t),
  'Completed',
  { timeout: 10000 },
)
const afterBtn = page.getByRole('button', { name: /Tally file \(\d+ ledgers?\)/i })
ok(await afterBtn.count() > 0, 'consolidated button still shown after marking created in Tally')
const bundle2 = await downloadBundle()
ok(bundle2.includes(drName), 'completed ledger is STILL in the consolidated file (the reported bug)')
ok(
  (bundle2.match(/<TALLYMESSAGE/g) || []).length === msgCount,
  'marking created in Tally does not shrink the consolidated file',
)

// The Approved tab must also keep it, since it was still approved.
await page.getByRole('button', { name: /^Approved \(\d+\)$/ }).click()
await page.waitForTimeout(300)
const approvedText = await page.locator('main').innerText()
ok(approvedText.includes(drName), 'completed request still listed under the Approved tab')

// cleanup
await rq.from('requests').delete().eq('id', creq.id)
await rq.from('requests').delete().eq('id', dreq.id)
await browser.close()
console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
