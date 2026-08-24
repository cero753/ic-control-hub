import { createClient } from '@supabase/supabase-js'

const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'

const mk = () => createClient(url, anon, { auth: { persistSession: false } })
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

// 1. Requestor signs in
const rq = mk()
const { data: rqAuth, error: rqErr } = await rq.auth.signInWithPassword({
  email: 'requestor@ichub.com', password: 'Passw0rd!',
})
ok(!rqErr && rqAuth.user, `requestor login (${rqErr?.message ?? 'ok'})`)

// 2. Requestor reads controls
const { data: controls } = await rq.from('controls').select('id').order('id')
ok(controls?.length === 36, `requestor sees 36 controls (got ${controls?.length})`)

// 3. Requestor raises a ledger request against FSCR-01
const { data: newReq, error: insErr } = await rq
  .from('requests')
  .insert({
    control_id: 'FSCR-01',
    requestor_id: rqAuth.user.id,
    title: 'Create ledger: Office Rent - Bangalore',
    payload: { ledgerName: 'Office Rent - Bangalore', parentGroup: 'Indirect Expenses', openingBalance: '0', ledgerType: 'Dr', notes: 'Monthly office rent' },
    status: 'pending',
  })
  .select()
  .single()
ok(!insErr && newReq, `requestor raises ledger request (${insErr?.message ?? 'ok'})`)
const reqId = newReq?.id

// 4. Approver signs in
const ap = mk()
const { data: apAuth, error: apErr } = await ap.auth.signInWithPassword({
  email: 'approver@ichub.com', password: 'Passw0rd!',
})
ok(!apErr && apAuth.user, `approver login (${apErr?.message ?? 'ok'})`)

// 5. Approver sees the pending request (RLS: approver reads all)
const { data: pending } = await ap.from('requests').select('id,status').eq('status', 'pending')
ok((pending?.length ?? 0) >= 1 && pending?.some(r => r.id === reqId), `approver sees pending request in inbox (${pending?.length} pending)`)

// 6. Approver approves: insert approval + update status
const { error: apvErr } = await ap.from('approvals').insert({
  request_id: reqId, approver_id: apAuth.user.id, decision: 'approved', comment: 'Approved - valid expense ledger',
})
ok(!apvErr, `approver inserts approval (${apvErr?.message ?? 'ok'})`)
const { error: updErr } = await ap.from('requests').update({ status: 'approved' }).eq('id', reqId)
ok(!updErr, `approver updates request to approved (${updErr?.message ?? 'ok'})`)

// 7. Requestor sees it approved + reads approval on own request
const { data: mine } = await rq.from('requests').select('id,status, approvals(decision,comment)').eq('id', reqId).single()
ok(mine?.status === 'approved', `requestor sees status=approved (got ${mine?.status})`)
ok(mine?.approvals?.length === 1 && mine.approvals[0].decision === 'approved', `requestor reads approval on own request`)

// 8. Requestor marks completed
const { error: compErr } = await rq.from('requests').update({ status: 'completed' }).eq('id', reqId)
ok(!compErr, `requestor marks completed (${compErr?.message ?? 'ok'})`)

// 9. RLS negative check: a second requestor-owned view must not leak others.
//    Approver-created requests should not be visible to requestor unless owned.
const { data: allAsRequestor } = await rq.from('requests').select('id,requestor_id')
const onlyOwn = (allAsRequestor ?? []).every(r => r.requestor_id === rqAuth.user.id)
ok(onlyOwn, `RLS: requestor only sees own requests (${allAsRequestor?.length} rows, all own=${onlyOwn})`)

// 10. RLS: requestor cannot insert an approval (not an approver)
const { error: badApv } = await rq.from('approvals').insert({
  request_id: reqId, approver_id: rqAuth.user.id, decision: 'approved',
})
ok(!!badApv, `RLS: requestor blocked from inserting approval (${badApv ? 'blocked' : 'LEAKED'})`)

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
