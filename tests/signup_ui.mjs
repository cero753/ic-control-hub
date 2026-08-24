import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'
const BASE = process.env.BASE_URL || 'https://ic-control-hub.netlify.app'
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m) } else { fail++; console.log('  ✗ FAIL:', m) } }

const email = `uitest_${String(Date.now()).slice(-7)}@ichub.com`
const browser = await chromium.launch()
const page = await (await browser.newContext()).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })

// switch to Sign up tab
await page.getByRole('button', { name: 'Sign up' }).click()
await page.fill('input[type=text]', 'UI Signup User')
await page.fill('input[type=email]', email)
await page.fill('input[type=password]', 'Passw0rd!')
await page.getByRole('button', { name: /Create account/i }).click()

// new users are auto-confirmed -> signup logs straight in and redirects to /controls
await page.waitForURL('**/controls', { timeout: 15000 })
ok(page.url().includes('/controls'), 'signup auto-logs-in and reaches /controls')

// wait for profile to load, then confirm requestor role
await page.waitForFunction(
  () => /requestor/i.test(document.querySelector('header')?.innerText ?? ''),
  { timeout: 10000 },
)
const headerText = await page.locator('header').innerText()
ok(!/Approvals/.test(headerText), 'new user has requestor role (no Approvals nav)')
ok(/requestor/i.test(headerText), 'role badge shows requestor')

ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
await browser.close()

// cleanup: remove the throwaway user (and any leftover probe users)
const admin = createClient(url, anon)
// we can't delete via anon; do it through SQL by exposing nothing — just report id for external cleanup
console.log('  created test user:', email)
console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
