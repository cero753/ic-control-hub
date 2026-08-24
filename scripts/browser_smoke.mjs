import { chromium } from 'playwright'

const BASE = 'https://ic-control-hub.netlify.app'
let fail = 0
const ok = (c, m) => { console.log(c ? '  PASS' : '  FAIL', m); if (!c) fail++ }

const browser = await chromium.launch()

async function run(role, email) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(BASE, { waitUntil: 'networkidle' })
  // login form present
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', 'Passw0rd!')
  await page.click('button[type=submit]')
  // should land on controls
  await page.waitForURL('**/controls', { timeout: 15000 })
  await page.waitForSelector('text=Controls Library', { timeout: 10000 })
  const cards = await page.locator('a[href^="/controls/"]').count()
  ok(cards >= 30, `[${role}] controls library rendered (${cards} control cards)`)

  if (role === 'approver') {
    await page.click('text=Approvals')
    await page.waitForURL('**/approvals')
    await page.waitForSelector('text=Approvals Inbox', { timeout: 10000 })
    // wait for the async fetch to resolve: either a request card or an empty-state
    await page.waitForFunction(
      () => {
        const t = document.querySelector('main')?.innerText ?? ''
        return /Create ledger|Chart of account/i.test(t) || /No .*requests/i.test(t)
      },
      { timeout: 15000 },
    )
    const bodyText = await page.locator('main').innerText()
    ok(!/could not find a relationship|PGRST/i.test(bodyText), `[approver] inbox has no PostgREST error`)
    const hasPending = /Create ledger|Chart of account/i.test(bodyText)
    ok(hasPending, `[approver] pending request visible in inbox`)
    // exercise the approve action end-to-end in the browser
    if (hasPending) {
      await page.getByRole('button', { name: 'Approve', exact: true }).first().click()
      // after approval the request leaves the Pending tab; the Approved tab count becomes 1
      await page.waitForFunction(
        () => /Approved \(1\)/.test(document.querySelector('main')?.innerText ?? ''),
        { timeout: 10000 },
      )
      ok(true, `[approver] approve action succeeded in browser (Approved tab now 1)`)
    }
  } else {
    await page.click('text=My Requests')
    await page.waitForURL('**/my-requests')
    await page.waitForSelector('text=My Requests', { timeout: 10000 })
    ok(true, `[requestor] My Requests page rendered`)
  }

  const realErrors = errors.filter((e) => !/favicon|manifest|404 \(\)/i.test(e))
  ok(realErrors.length === 0, `[${role}] no page/console errors${realErrors.length ? ': ' + realErrors.slice(0, 2).join(' | ') : ''}`)
  await ctx.close()
}

await run('requestor', 'requestor@ichub.com')
await run('approver', 'approver@ichub.com')
await browser.close()
console.log(fail === 0 ? '\nBROWSER SMOKE: ALL PASS' : `\nBROWSER SMOKE: ${fail} FAILED`)
process.exit(fail ? 1 : 0)
