import { createClient } from '@supabase/supabase-js'
const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'
const c = createClient(url, anon, { auth: { persistSession: false } })

const email = `probe_${String(Date.now()).slice(-7)}@ichub.com`
console.log('signing up', email, 'WITH metadata role=approver (privilege-escalation probe)')
const { data: su, error: suErr } = await c.auth.signUp({
  email, password: 'Passw0rd!',
  options: { data: { full_name: 'Probe User', role: 'approver' } },
})
console.log('  signUp error:', suErr?.message ?? 'none')
console.log('  session returned:', su?.session ? 'YES (auto-confirmed)' : 'NO (confirmation required)')
console.log('  user id:', su?.user?.id ?? 'none')

// try immediate login
const { data: si, error: siErr } = await c.auth.signInWithPassword({ email, password: 'Passw0rd!' })
console.log('  immediate login:', siErr ? `FAILS (${siErr.message})` : 'OK')

// if logged in, read own profile role
if (si?.session) {
  const { data: prof } = await c.from('profiles').select('role').eq('id', si.user.id).maybeSingle()
  console.log('  resulting profile role:', prof?.role, prof?.role === 'approver' ? '  <-- PRIVILEGE ESCALATION' : '(safe)')
}
console.log('  probe user id for cleanup:', su?.user?.id)
