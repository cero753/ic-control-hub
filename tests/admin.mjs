// Admin portal backend tests: role guard, admin visibility, account provisioning.
import { createClient } from '@supabase/supabase-js'

const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'
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

function client() {
  return createClient(url, anon, { auth: { persistSession: false } })
}

async function signIn(email) {
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`${email}: ${error.message}`)
  return { c, uid: data.user.id }
}

const createdIds = []

console.log('\n== admin role + guard ==')
const admin = await signIn('admin@ichub.com')
const requestor = await signIn('requestor@ichub.com')
const approver = await signIn('approver@ichub.com')

{
  const { data } = await admin.c.from('profiles').select('role').eq('id', admin.uid).single()
  ok(data?.role === 'admin', 'admin@ichub.com has role admin')
}

console.log('\n== privilege escalation is blocked ==')
{
  // The "own profile update" policy has no WITH CHECK, so Postgres reuses its USING
  // clause and the row-level check passes. The guard trigger must be what stops this.
  const { error } = await requestor.c
    .from('profiles')
    .update({ role: 'approver' })
    .eq('id', requestor.uid)
  ok(!!error, `requestor cannot self-promote (${error?.message ?? 'NO ERROR - ESCALATION'})`)

  const { data } = await requestor.c.from('profiles').select('role').eq('id', requestor.uid).single()
  ok(data?.role === 'requestor', 'requestor role unchanged after escalation attempt')
}
{
  const { error } = await approver.c
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', approver.uid)
  ok(!!error, 'approver cannot self-promote to admin')
}
{
  const { data } = await requestor.c
    .from('profiles')
    .update({ role: 'approver' })
    .eq('id', approver.uid)
    .select()
  ok((data?.length ?? 0) === 0, 'requestor cannot change another user role')
}

console.log('\n== admin visibility ==')
{
  const { data, error } = await admin.c.from('profiles').select('id, email, role')
  ok(!error && (data?.length ?? 0) >= 3, `admin reads all profiles (${data?.length ?? 0})`)
}
{
  const { data, error } = await admin.c
    .from('requests')
    .select('*, controls(*), requestor:profiles!requests_requestor_id_fkey(full_name, email), approvals(*, approver:profiles(full_name, email))')
  ok(!error, `admin reads all requests with joins (${error?.message ?? 'ok'})`)
  ok((data?.length ?? 0) >= 1, `admin sees at least one request (${data?.length ?? 0})`)
}
{
  const { data, error } = await admin.c.from('approvals').select('*')
  ok(!error, 'admin reads all approvals')
  void data
}
{
  const { data } = await requestor.c.from('profiles').select('id')
  ok((data?.length ?? 0) === 1, 'requestor still only sees own profile')
}

console.log('\n== admin_create_user RPC ==')
{
  const { error } = await requestor.c.rpc('admin_create_user', {
    p_email: `sneaky_${String(Date.now()).slice(-7)}@ichub.com`,
    p_password: PW,
    p_full_name: 'Sneaky',
    p_role: 'admin',
  })
  ok(!!error, `non-admin cannot call admin_create_user (${error?.message ?? 'NO ERROR'})`)
}
{
  const email = `newapprover_${String(Date.now()).slice(-7)}@ichub.com`
  const { data, error } = await admin.c.rpc('admin_create_user', {
    p_email: email,
    p_password: PW,
    p_full_name: 'New Approver',
    p_role: 'approver',
  })
  ok(!error, `admin creates an approver account (${error?.message ?? 'ok'})`)
  ok(data?.role === 'approver', 'created account has role approver')
  if (data?.id) createdIds.push(data.id)

  // The new account must actually be able to sign in (auto-confirmed).
  const c2 = client()
  const { data: si, error: siErr } = await c2.auth.signInWithPassword({ email, password: PW })
  ok(!siErr && !!si?.session, `created account can sign in (${siErr?.message ?? 'ok'})`)
  if (si?.session) {
    const { data: reqs, error: rErr } = await c2.from('requests').select('id')
    ok(!rErr && (reqs?.length ?? 0) >= 1, 'created approver can read all requests')
  }
}
{
  const email = `newrequestor_${String(Date.now()).slice(-7)}@ichub.com`
  const { data, error } = await admin.c.rpc('admin_create_user', {
    p_email: email,
    p_password: PW,
    p_full_name: 'New Requestor',
    p_role: 'requestor',
  })
  ok(!error && data?.role === 'requestor', `admin creates a requestor account (${error?.message ?? 'ok'})`)
  if (data?.id) createdIds.push(data.id)
}
{
  const { error } = await admin.c.rpc('admin_create_user', {
    p_email: 'not-an-email',
    p_password: PW,
    p_full_name: 'X',
    p_role: 'requestor',
  })
  ok(!!error, 'rejects an invalid email')
}
{
  const { error } = await admin.c.rpc('admin_create_user', {
    p_email: `short_${String(Date.now()).slice(-7)}@ichub.com`,
    p_password: 'abc',
    p_full_name: 'X',
    p_role: 'requestor',
  })
  ok(!!error, 'rejects a short password')
}
{
  const { error } = await admin.c.rpc('admin_create_user', {
    p_email: `badrole_${String(Date.now()).slice(-7)}@ichub.com`,
    p_password: PW,
    p_full_name: 'X',
    p_role: 'superuser',
  })
  ok(!!error, 'rejects an unknown role')
}
{
  const { error } = await admin.c.rpc('admin_create_user', {
    p_email: 'requestor@ichub.com',
    p_password: PW,
    p_full_name: 'Dup',
    p_role: 'requestor',
  })
  ok(!!error, 'rejects a duplicate email')
}

console.log('\n== admin role management ==')
{
  const target = createdIds[createdIds.length - 1]
  const { data, error } = await admin.c
    .from('profiles')
    .update({ role: 'approver' })
    .eq('id', target)
    .select()
    .single()
  ok(!error && data?.role === 'approver', `admin promotes a user to approver (${error?.message ?? 'ok'})`)

  const { data: back } = await admin.c
    .from('profiles')
    .update({ role: 'requestor' })
    .eq('id', target)
    .select()
    .single()
  ok(back?.role === 'requestor', 'admin demotes a user back to requestor')
}
{
  const { error } = await admin.c
    .from('profiles')
    .update({ role: 'requestor' })
    .eq('id', admin.uid)
  ok(!!error, `last admin cannot be demoted (${error?.message ?? 'NO ERROR'})`)
}

console.log('\ncreated test user ids (cleanup):', createdIds.join(', ') || 'none')
console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
