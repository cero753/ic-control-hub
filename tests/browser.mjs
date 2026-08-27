import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'

const BASE = process.env.BASE_URL || 'https://ic-control-hub.netlify.app'
const PW = 'Passw0rd!'
let pass = 0, fail = 0
const fails = []
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m) } else { fail++; fails.push(m); console.log('  ✗ FAIL:', m) } }
const section = (s) => console.log(`\n== ${s} ==`)

const browser = await chromium.launch()
const errorsByRole = {}

async function login(page, email) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', PW)
  await page.click('button[type=submit]')
  await page.waitForURL('**/controls', { timeout: 15000 })
}

function trackErrors(page, role) {
  errorsByRole[role] = []
  page.on('pageerror', (e) => errorsByRole[role].push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errorsByRole[role].push(m.text()) })
}

const uniq = String(Date.now()).slice(-6)
const drName = `E2E Dr Ledger ${uniq}`
const crName = `E2E Cr Ledger ${uniq}`
const genTitle = `E2E Generic ${uniq}`

// ---------------- REQUESTOR ----------------
section('Requestor: login validation')
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  trackErrors(page, 'login')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.fill('input[type=email]', 'requestor@ichub.com')
  await page.fill('input[type=password]', 'definitely-wrong')
  await page.click('button[type=submit]')
  await page.waitForSelector('text=/invalid|credentials/i', { timeout: 10000 }).catch(() => {})
  const txt = await page.locator('body').innerText()
  ok(/invalid|credentials/i.test(txt), 'wrong password shows error message')
  ok(!page.url().includes('/controls'), 'stayed on login after bad password')
  await ctx.close()
}

const rctx = await browser.newContext()
const rpage = await rctx.newPage()
trackErrors(rpage, 'requestor')

section('Requestor: login + controls library')
await login(rpage, 'requestor@ichub.com')
ok(rpage.url().includes('/controls'), 'login redirects to /controls')
await rpage.waitForSelector('text=Controls Library')
const allCards = await rpage.locator('a[href^="/controls/"]').count()
ok(allCards === 36, `36 control cards shown (got ${allCards})`)

// framework filter
await rpage.getByRole('button', { name: /^FSCR \(10\)/ }).click()
await rpage.waitForTimeout(200)
const fscrCards = await rpage.locator('a[href^="/controls/"]').count()
ok(fscrCards === 10, `FSCR filter shows 10 (got ${fscrCards})`)
await rpage.getByRole('button', { name: /^All \(36\)/ }).click()

// search
await rpage.fill('input[type=search]', 'vendor')
await rpage.waitForTimeout(300)
const vendorCards = await rpage.locator('a[href^="/controls/"]').count()
ok(vendorCards > 0 && vendorCards < 36, `search 'vendor' narrows results (got ${vendorCards})`)
await rpage.fill('input[type=search]', '')

section('Requestor: control detail (FSCR-01)')
await rpage.goto(`${BASE}/controls/FSCR-01`, { waitUntil: 'networkidle' })
await rpage.waitForSelector('text=Chart of account management')
const detailText = await rpage.locator('main').innerText()
ok(/Control Objective/i.test(detailText), 'detail shows Control Objective')
ok(/Risk/i.test(detailText), 'detail shows Risk')
ok(/Financial Statement Assertions/i.test(detailText), 'detail shows assertions section')
const assertionRows = await rpage.locator('table tbody tr').count()
ok(assertionRows === 7, `assertions table has 7 rows (got ${assertionRows})`)
ok(/Raise ledger creation request/i.test(detailText), 'ledger control shows raise-ledger button')

section('Requestor: raise ledger request (Dr) via UI')
await rpage.getByRole('link', { name: /Raise ledger creation request/i }).click()
await rpage.waitForURL('**/controls/FSCR-01/request')
await rpage.fill('input[placeholder*="Create ledger"]', drName).catch(async () => {})
// title optional; fill ledger fields
const nameInput = rpage.getByLabel('Ledger name')
await nameInput.fill(drName)
await rpage.getByLabel('Parent group (Tally)').selectOption('Indirect Expenses')

// The amount used to be <input type="number">, which shows spinner arrows and
// resists manual entry. Type it a character at a time to prove it takes a
// hand-keyed figure with decimals, and that letters are rejected.
const balance = rpage.getByLabel('Opening balance')
ok((await balance.getAttribute('type')) === 'text', 'opening balance is not a spinner number input')
ok((await balance.getAttribute('inputmode')) === 'decimal', 'opening balance still gets a numeric keypad')
await balance.click()
await balance.pressSequentially('2500.50', { delay: 20 })
ok((await balance.inputValue()) === '2500.50', 'opening balance accepts a manually typed decimal')
await balance.pressSequentially('abc', { delay: 20 })
ok((await balance.inputValue()) === '2500.50', 'non-numeric keystrokes are ignored')
await balance.fill('')
await balance.pressSequentially('2500', { delay: 20 })
ok((await balance.inputValue()) === '2500', 'opening balance can be cleared and retyped')

await rpage.getByLabel('Balance type').selectOption('Dr')
await rpage.getByRole('button', { name: /Submit request/i }).click()
await rpage.waitForURL('**/my-requests', { timeout: 15000 })
await rpage.waitForFunction((n) => document.querySelector('main')?.innerText.includes(n), drName, { timeout: 10000 })
ok(true, 'ledger request appears in My Requests')
const drCardMine = rpage.locator('div.rounded-xl.border').filter({ hasText: drName }).first()
ok(/Pending/i.test(await drCardMine.innerText()), 'new request is Pending')

section('Requestor: raise generic request via UI (P2P-06)')
await rpage.goto(`${BASE}/controls/P2P-06/request`, { waitUntil: 'networkidle' })
await rpage.getByLabel('Request title (optional)').fill(genTitle)
await rpage.getByLabel(/Details/i).fill('E2E generic request details for testing')
await rpage.getByLabel(/Amount/i).fill('9999')
await rpage.getByRole('button', { name: /Submit request/i }).click()
await rpage.waitForURL('**/my-requests', { timeout: 15000 })
await rpage.waitForFunction((n) => document.querySelector('main')?.innerText.includes(n), genTitle, { timeout: 10000 })
ok(true, 'generic request appears in My Requests')

section('Requestor: role-gating + session')
await rpage.goto(`${BASE}/approvals`, { waitUntil: 'networkidle' })
await rpage.waitForTimeout(500)
ok(rpage.url().includes('/controls') || !rpage.url().includes('/approvals'), 'requestor redirected away from /approvals')
await rpage.goto(`${BASE}/my-requests`, { waitUntil: 'networkidle' })
await rpage.reload({ waitUntil: 'networkidle' })
ok(!rpage.url().includes('/login'), 'session persists after reload')

// ---------------- APPROVER ----------------
const actx = await browser.newContext()
const apage = await actx.newPage()
trackErrors(apage, 'approver')

section('Approver: inbox + approve (Dr ledger)')
await login(apage, 'approver@ichub.com')
await apage.getByRole('link', { name: 'Approvals' }).first().waitFor({ timeout: 10000 })
ok(true, 'approver sees Approvals nav link')
await apage.goto(`${BASE}/approvals`, { waitUntil: 'networkidle' })
await apage.waitForSelector('text=Approvals Inbox')
await apage.waitForFunction((n) => document.querySelector('main')?.innerText.includes(n), drName, { timeout: 15000 })
const inboxText = await apage.locator('main').innerText()
ok(!/could not find a relationship|PGRST/i.test(inboxText), 'inbox has no query error')
ok(inboxText.includes('Riya Requestor'), 'inbox shows requestor name')
ok(inboxText.includes('Chart of account management'), 'inbox shows control context')

// approve the Dr ledger card with a comment
const drCard = apage.locator('div.rounded-xl.border').filter({ hasText: drName }).first()
await drCard.getByPlaceholder('Comment (optional)').fill('Approved via E2E')
await drCard.getByRole('button', { name: 'Approve', exact: true }).click()
await apage.waitForFunction((n) => !document.querySelector('main')?.innerText.includes(n), drName, { timeout: 10000 }).catch(() => {})
await apage.getByRole('button', { name: /^Approved \(/ }).click()
await apage.waitForFunction((n) => document.querySelector('main')?.innerText.includes(n), drName, { timeout: 10000 })
ok(true, 'Dr ledger moved to Approved tab')

section('Approver: reject (generic)')
await apage.getByRole('button', { name: /^Pending \(/ }).click()
await apage.waitForFunction((n) => document.querySelector('main')?.innerText.includes(n), genTitle, { timeout: 10000 })
const genCard = apage.locator('div.rounded-xl.border').filter({ hasText: genTitle }).first()
await genCard.getByPlaceholder('Comment (optional)').fill('Rejected via E2E')
await genCard.getByRole('button', { name: 'Reject', exact: true }).click()
await apage.getByRole('button', { name: /^Rejected \(/ }).click()
await apage.waitForFunction((n) => document.querySelector('main')?.innerText.includes(n), genTitle, { timeout: 10000 })
ok(true, 'generic request moved to Rejected tab')

// ---------------- REQUESTOR: post-decision + XML ----------------
section('Requestor: approved request + Tally XML download (Dr)')
await rpage.goto(`${BASE}/my-requests`, { waitUntil: 'networkidle' })
await rpage.waitForFunction((n) => document.querySelector('main')?.innerText.includes(n), drName, { timeout: 10000 })
const rDrCard = rpage.locator('div.rounded-xl.border').filter({ hasText: drName }).first()
ok(/Approved/i.test(await rDrCard.innerText()), 'requestor sees Dr request Approved')
ok((await rDrCard.innerText()).includes('Approved via E2E'), 'requestor sees approver comment')
const [download] = await Promise.all([
  rpage.waitForEvent('download'),
  rDrCard.getByRole('button', { name: /Download Tally XML/i }).click(),
])
const xmlPath = await download.path()
const xml = await readFile(xmlPath, 'utf-8')
ok(xml.includes('<TALLYREQUEST>Import Data</TALLYREQUEST>'), 'XML has Tally import envelope')
ok(xml.includes(`<NAME>${drName}</NAME>`), 'XML has ledger name')
ok(xml.includes('<PARENT>Indirect Expenses</PARENT>'), 'XML has parent group')
ok(/<OPENINGBALANCE>2500<\/OPENINGBALANCE>/.test(xml), 'XML Dr opening balance positive (2500)')
ok(xml.includes('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>'), 'XML Dr isdeemedpositive=Yes')

section('Requestor: mark completed')
await rDrCard.getByRole('button', { name: /Mark created in Tally/i }).click()
await rpage.waitForFunction((n) => {
  const card = [...document.querySelectorAll('div.rounded-xl.border')].find((d) => d.innerText.includes(n))
  return card && /Completed/i.test(card.innerText)
}, drName, { timeout: 10000 })
ok(true, 'Dr request marked Completed')

section('Requestor: rejected request visible')
const rGenCard = rpage.locator('div.rounded-xl.border').filter({ hasText: genTitle }).first()
ok(/Rejected/i.test(await rGenCard.innerText()), 'requestor sees generic request Rejected')
ok((await rGenCard.innerText()).includes('Rejected via E2E'), 'requestor sees rejection comment')

section('Requestor: sign out')
await rpage.getByRole('button', { name: /Sign out/i }).click()
await rpage.waitForURL('**/login', { timeout: 10000 })
ok(rpage.url().includes('/login'), 'sign out returns to /login')

section('Console/page errors')
for (const [role, errs] of Object.entries(errorsByRole)) {
  // "Failed to load resource" logs are HTTP status lines (e.g. the expected 400 on a
  // wrong-password login) — not JS exceptions. Real bugs surface as pageerror/other console errors.
  const real = errs.filter((e) => !/favicon|manifest|404|net::ERR|Failed to load resource/i.test(e))
  ok(real.length === 0, `[${role}] no runtime errors${real.length ? ': ' + real.slice(0, 2).join(' | ') : ''}`)
}

await browser.close()
console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
if (fail) { console.log('FAILURES:'); fails.forEach((f) => console.log(' -', f)) }
process.exit(fail ? 1 : 0)
