// Admin portal end-to-end tests, plus XML download for every role.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'
const BASE = process.env.BASE_URL || 'https://ic-control-hub.netlify.app'
const PW = 'Passw0rd!'

let pass = 0
let fail = 0
const ok = (c, m) => {
  if (c) {
    pass++
    console.log('  PASS', m)
  } else {
    fail++
    console.log('  FAIL', m)
  }
}

const browser = await chromium.launch()

async function loginAs(email) {
  const ctx = await browser.newContext({ acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', PW)
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/controls', { timeout: 20000 })
  await page.waitForFunction(
    () => /requestor|approver|admin/i.test(document.querySelector('header')?.innerText ?? ''),
    { timeout: 20000 },
  )
  return { ctx, page, errors }
}

// ---------------------------------------------------------------- setup
// Approve the seeded pending request so the XML download path is reachable,
// then restore it at the end so the demo data stays as it was.
const api = createClient(url, anon, { auth: { persistSession: false } })
const { data: appAuth } = await api.auth.signInWithPassword({
  email: 'approver@ichub.com',
  password: PW,
})
const { data: seedReqs } = await api
  .from('requests')
  .select('id, status, control_id')
  .eq('control_id', 'FSCR-01')
  .order('created_at', { ascending: true })
const seedReq = seedReqs?.[0]
const originalStatus = seedReq?.status
await api.from('requests').update({ status: 'approved' }).eq('id', seedReq.id)
const { data: seedApproval } = await api
  .from('approvals')
  .insert({
    request_id: seedReq.id,
    approver_id: appAuth.user.id,
    decision: 'approved',
    comment: 'Approved for admin portal test',
  })
  .select()
  .single()

const createdUserEmails = []

try {
  // ------------------------------------------------------------ admin nav
  console.log('\n== admin portal access ==')
  const admin = await loginAs('admin@ichub.com')
  {
    const header = await admin.page.locator('header').innerText()
    ok(/Admin/.test(header), 'admin sees the Admin nav link')
    ok(/admin/i.test(header), 'header badge shows admin')
    ok(/Approvals/.test(header), 'admin also sees Approvals (inherits approver rights)')
  }

  // ------------------------------------------------------------ users tab
  console.log('\n== admin users ==')
  await admin.page.getByRole('link', { name: 'Admin', exact: true }).first().click()
  await admin.page.waitForURL('**/admin', { timeout: 15000 })
  await admin.page.waitForSelector('table tbody tr', { timeout: 15000 })
  const rowCount = await admin.page.locator('table tbody tr').count()
  ok(rowCount >= 3, `users table lists every account (${rowCount})`)
  {
    const body = await admin.page.locator('table').innerText()
    ok(/requestor@ichub\.com/.test(body), 'requestor account is visible to admin')
    ok(/approver@ichub\.com/.test(body), 'approver account is visible to admin')
  }

  // ------------------------------------------------- create a new account
  console.log('\n== admin creates accounts ==')
  const newApprover = `pa_${String(Date.now()).slice(-7)}@ichub.com`
  createdUserEmails.push(newApprover)
  await admin.page.getByRole('button', { name: '+ Add account' }).click()
  await admin.page.fill('#new-full-name', 'Portal Approver')
  await admin.page.fill('#new-email', newApprover)
  await admin.page.fill('#new-password', PW)
  await admin.page.selectOption('#new-role', 'approver')
  await admin.page.getByRole('button', { name: 'Create account' }).click()
  await admin.page.waitForFunction(
    (e) => document.querySelector('table')?.innerText.includes(e),
    newApprover,
    { timeout: 20000 },
  )
  ok(true, 'new approver account appears in the users table')
  {
    const row = admin.page.locator('table tbody tr', { hasText: newApprover })
    ok((await row.innerText()).includes('approver'), 'new account was created with the approver role')
  }

  // the new approver must actually be able to sign in and see the inbox
  {
    const fresh = await loginAs(newApprover)
    const header = await fresh.page.locator('header').innerText()
    ok(/Approvals/.test(header), 'newly created approver can reach the Approvals inbox')
    ok(!/Admin/.test(header), 'newly created approver does NOT see the Admin link')
    await fresh.ctx.close()
  }

  // --------------------------------------------------- change a role live
  console.log('\n== admin changes roles ==')
  {
    const row = admin.page.locator('table tbody tr', { hasText: newApprover })
    await row.locator('select').selectOption('requestor')
    await admin.page.waitForFunction(
      (e) => {
        const tr = [...document.querySelectorAll('table tbody tr')].find((r) =>
          r.innerText.includes(e),
        )
        return tr && /requestor/.test(tr.innerText)
      },
      newApprover,
      { timeout: 20000 },
    )
    ok(true, 'admin demoted the account to requestor')

    await row.locator('select').selectOption('approver')
    await admin.page.waitForFunction(
      (e) => {
        const tr = [...document.querySelectorAll('table tbody tr')].find((r) =>
          r.innerText.includes(e),
        )
        return tr && /approver/.test(tr.innerText)
      },
      newApprover,
      { timeout: 20000 },
    )
    ok(true, 'admin promoted the account back to approver')
  }

  // ------------------------------------------------------ requests tab
  console.log('\n== admin all requests ==')
  await admin.page.getByRole('link', { name: 'All Requests' }).click()
  await admin.page.waitForURL('**/admin/requests', { timeout: 15000 })
  // Wait for the cards themselves, not for the spinner to go: the spinner belongs to
  // AdminRequests, so between navigating and that component mounting the page briefly
  // shows neither and a "no longer loading" check passes against a half-rendered page.
  await admin.page.waitForFunction(
    () => (document.querySelector('main')?.innerText ?? '').includes('FSCR-01'),
    { timeout: 20000 },
  )
  {
    const text = await admin.page.locator('main').innerText()
    ok(/FSCR-01/.test(text), 'admin sees requests raised by other users')
    ok(/Riya Requestor/.test(text), 'admin sees who raised each request')
    ok(/Approved for admin portal test/.test(text), 'admin sees the approval decision + comment')
  }
  {
    const [csv] = await Promise.all([
      admin.page.waitForEvent('download', { timeout: 20000 }),
      admin.page.getByRole('button', { name: /Export CSV/i }).click(),
    ])
    ok(csv.suggestedFilename() === 'ic-control-hub-requests.csv', 'admin exports all requests as CSV')
  }

  // ------------------------------------------------- controls tab
  console.log('\n== admin all controls ==')
  await admin.page.getByRole('link', { name: 'All Controls' }).click()
  await admin.page.waitForURL('**/admin/controls', { timeout: 15000 })
  await admin.page.waitForSelector('table tbody tr', { timeout: 20000 })
  const controlRows = await admin.page.locator('table tbody tr').count()
  ok(controlRows === 36, `all 36 controls listed (${controlRows})`)

  ok(admin.errors.length === 0, `no page errors in admin portal${admin.errors.length ? ': ' + admin.errors[0] : ''}`)

  // --------------------------------------------- XML download, every role
  console.log('\n== Tally XML download by role ==')
  for (const [label, email, path] of [
    ['requestor', 'requestor@ichub.com', '/my-requests'],
    ['approver', 'approver@ichub.com', '/approvals'],
    ['admin', 'admin@ichub.com', '/admin/requests'],
  ]) {
    const s = await loginAs(email)
    await s.page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
    // The approvals inbox opens on the Pending tab, which by definition excludes
    // the approved request whose XML we want.
    if (path === '/approvals') {
      await s.page.getByRole('button', { name: /^Approved \(/ }).click()
    }
    const btn = s.page.getByRole('button', { name: /Download Tally XML/i }).first()
    await btn.waitFor({ timeout: 20000 })
    const [download] = await Promise.all([
      s.page.waitForEvent('download', { timeout: 20000 }),
      btn.click(),
    ])
    const stream = await download.createReadStream()
    let xml = ''
    for await (const chunk of stream) xml += chunk
    ok(download.suggestedFilename().endsWith('-tally.xml'), `${label} downloads a *-tally.xml file`)
    ok(xml.includes('<TALLYREQUEST>Import Data</TALLYREQUEST>'), `${label}'s XML is a Tally import envelope`)
    ok(xml.includes('<LEDGER'), `${label}'s XML contains a LEDGER master`)
    await s.ctx.close()
  }

  // ------------------------------------------- non-admins are locked out
  console.log('\n== admin route is guarded ==')
  for (const [label, email] of [
    ['requestor', 'requestor@ichub.com'],
    ['approver', 'approver@ichub.com'],
  ]) {
    const s = await loginAs(email)
    const header = await s.page.locator('header').innerText()
    ok(!/Admin/.test(header), `${label} does not see the Admin nav link`)
    await s.page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' })
    await s.page.waitForURL('**/controls', { timeout: 20000 }).catch(() => {})
    ok(s.page.url().includes('/controls'), `${label} is redirected away from /admin`)
    await s.ctx.close()
  }

  await admin.ctx.close()
} finally {
  await browser.close()
  if (seedReq?.id) await api.from('requests').update({ status: originalStatus }).eq('id', seedReq.id)
  // Approvals are an immutable audit trail — there is deliberately no DELETE policy,
  // so the row this run inserted cannot be removed from the client. Same for the
  // accounts it created. Both need a privileged cleanup:
  console.log('\nManual cleanup (run as a privileged SQL user):')
  if (seedApproval?.id) console.log(`  delete from approvals where id = '${seedApproval.id}';`)
  if (createdUserEmails.length)
    console.log(`  delete from auth.users where email in (${createdUserEmails.map((e) => `'${e}'`).join(', ')});`)
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
