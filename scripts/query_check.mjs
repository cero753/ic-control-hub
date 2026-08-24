import { createClient } from '@supabase/supabase-js'
const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'
const mk = () => createClient(url, anon, { auth: { persistSession: false } })
let fail = 0
const ok = (c, m) => { console.log(c ? '  PASS' : '  FAIL', m); if (!c) fail++ }

// Seed one pending request first (as requestor) so embeds have data to resolve.
const rq = mk()
const { data: a } = await rq.auth.signInWithPassword({ email: 'requestor@ichub.com', password: 'Passw0rd!' })
await rq.from('requests').insert({
  control_id: 'FSCR-01', requestor_id: a.user.id,
  title: 'Create ledger: Office Rent - Bangalore',
  payload: { ledgerName: 'Office Rent - Bangalore', parentGroup: 'Indirect Expenses', openingBalance: '0', ledgerType: 'Dr', notes: 'Monthly office rent' },
  status: 'pending',
})

// EXACT MyRequests.tsx query (as requestor)
const myReq = await rq
  .from('requests')
  .select('*, controls(*), approvals(*, approver:profiles(full_name, email))')
  .eq('requestor_id', a.user.id)
  .order('created_at', { ascending: false })
ok(!myReq.error, `MyRequests exact query (${myReq.error?.message ?? 'ok'}, ${myReq.data?.length} rows)`)

// EXACT Approvals.tsx query (as approver)
const ap = mk()
await ap.auth.signInWithPassword({ email: 'approver@ichub.com', password: 'Passw0rd!' })
const apReq = await ap
  .from('requests')
  .select('*, controls(*), requestor:profiles!requests_requestor_id_fkey(full_name, email), approvals(*, approver:profiles(full_name, email))')
  .order('created_at', { ascending: false })
ok(!apReq.error, `Approvals exact query (${apReq.error?.message ?? 'ok'}, ${apReq.data?.length} rows)`)
if (apReq.data?.[0]) {
  const r = apReq.data[0]
  ok(!!r.controls && !!r.requestor, `Approvals embeds resolve (control=${r.controls?.sub_area}, requestor=${r.requestor?.full_name})`)
}

console.log(fail === 0 ? '\nALL QUERY CHECKS PASS' : `\n${fail} FAILED`)
process.exit(fail ? 1 : 0)
