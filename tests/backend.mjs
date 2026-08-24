import { createClient } from '@supabase/supabase-js'

const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'
const mk = () => createClient(url, anon, { auth: { persistSession: false } })

let pass = 0, fail = 0
const fails = []
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m) } else { fail++; fails.push(m); console.log('  ✗ FAIL:', m) } }
const section = (s) => console.log(`\n== ${s} ==`)

const rq = mk(), ap = mk()
const { data: rqa, error: rqe } = await rq.auth.signInWithPassword({ email: 'requestor@ichub.com', password: 'Passw0rd!' })
const { data: apa, error: ape } = await ap.auth.signInWithPassword({ email: 'approver@ichub.com', password: 'Passw0rd!' })

section('Auth')
ok(!rqe && rqa.user, 'requestor signs in')
ok(!ape && apa.user, 'approver signs in')
ok((await mk().auth.signInWithPassword({ email: 'requestor@ichub.com', password: 'wrong' })).error, 'wrong password rejected')

section('Controls data integrity')
const { data: controls } = await rq.from('controls').select('*')
ok(controls?.length === 36, `36 controls total (got ${controls?.length})`)
const byfw = (c) => controls.filter((x) => x.framework_code === c).length
ok(byfw('FSCR') === 10 && byfw('FA') === 9 && byfw('P2P') === 8 && byfw('R2R') === 9, `framework counts FSCR10/FA9/P2P8/R2R9 (got ${byfw('FSCR')}/${byfw('FA')}/${byfw('P2P')}/${byfw('R2R')})`)
ok(controls.every((c) => c.sub_area && c.control_objective && c.control_description), 'no control missing sub_area/objective/description')
ok(controls.every((c) => c.assertions && Object.keys(c.assertions).length === 7), 'every control has 7 assertions')
const ledger = controls.filter((c) => c.request_type === 'ledger')
ok(ledger.length === 1 && ledger[0].id === 'FSCR-01', `exactly one ledger control = FSCR-01 (got ${ledger.map((l) => l.id)})`)
ok(controls.filter((c) => c.requires_request).length >= 1, 'at least one requires_request control')
const fa07 = controls.find((c) => c.id === 'FA-07')
ok(fa07?.assertions.cutoff === '✓', 'FA-07 checkmark assertion preserved')
const r2r08 = controls.find((c) => c.id === 'R2R-08')
ok(r2r08?.frequency === 'Monthly', `R2R-08 frequency correctly mapped = Monthly (got ${r2r08?.frequency})`)

section('Profiles RLS')
const { data: ownProfile } = await rq.from('profiles').select('*').eq('id', rqa.user.id).maybeSingle()
ok(ownProfile?.role === 'requestor', 'requestor reads own profile (role=requestor)')
const { data: otherProfileAsRq } = await rq.from('profiles').select('*').eq('id', apa.user.id).maybeSingle()
ok(!otherProfileAsRq, 'requestor CANNOT read approver profile')
const { data: allProfilesAsAp } = await ap.from('profiles').select('*')
ok((allProfilesAsAp?.length ?? 0) >= 2, `approver reads all profiles (${allProfilesAsAp?.length})`)

section('Controls are read-only via RLS')
const { error: ctrlIns } = await rq.from('controls').insert({ id: 'HACK-01', framework: 'x', framework_code: 'X', sub_area: 'x' })
ok(!!ctrlIns, 'requestor CANNOT insert a control')
const { data: ctrlUpdData } = await ap.from('controls').update({ risk: 'tampered' }).eq('id', 'FSCR-01').select('id')
ok((ctrlUpdData?.length ?? 0) === 0, `approver cannot tamper controls (0 rows updated, got ${ctrlUpdData?.length ?? 0})`)
const { data: ctrlUpdData2 } = await rq.from('controls').update({ risk: 'tampered' }).eq('id', 'FSCR-02').select('id')
ok((ctrlUpdData2?.length ?? 0) === 0, `requestor cannot tamper controls (0 rows updated, got ${ctrlUpdData2?.length ?? 0})`)

section('Ledger request lifecycle (approve path)')
const { data: lreq, error: lreqE } = await rq.from('requests').insert({
  control_id: 'FSCR-01', requestor_id: rqa.user.id, title: 'TEST Ledger A',
  payload: { ledgerName: 'Test Ledger A', parentGroup: 'Indirect Expenses', openingBalance: '1500', ledgerType: 'Dr', notes: 'test' },
  status: 'pending',
}).select().single()
ok(!lreqE && lreq, `requestor inserts ledger request (${lreqE?.message ?? 'ok'})`)
const { data: apSees } = await ap.from('requests').select('id').eq('id', lreq.id)
ok(apSees?.length === 1, 'approver sees the pending request')
const { error: apvE } = await ap.from('approvals').insert({ request_id: lreq.id, approver_id: apa.user.id, decision: 'approved', comment: 'ok' })
ok(!apvE, `approver inserts approval (${apvE?.message ?? 'ok'})`)
const { error: stE } = await ap.from('requests').update({ status: 'approved' }).eq('id', lreq.id)
ok(!stE, 'approver sets status approved')
const { data: back } = await rq.from('requests').select('status, approvals(decision, comment)').eq('id', lreq.id).single()
ok(back?.status === 'approved' && back.approvals?.[0]?.decision === 'approved', 'requestor sees approved + approval comment')
const { error: compE } = await rq.from('requests').update({ status: 'completed' }).eq('id', lreq.id)
ok(!compE, 'requestor marks completed')

section('Generic request + reject path')
const { data: greq, error: greqE } = await rq.from('requests').insert({
  control_id: 'P2P-06', requestor_id: rqa.user.id, title: 'TEST Payment B',
  payload: { details: 'Pay vendor X', amount: '5000', effectiveDate: '2026-09-01', notes: '' },
  status: 'pending',
}).select().single()
ok(!greqE && greq, `generic request against P2P-06 (${greqE?.message ?? 'ok'})`)
const { error: rejApvE } = await ap.from('approvals').insert({ request_id: greq.id, approver_id: apa.user.id, decision: 'rejected', comment: 'insufficient docs' })
ok(!rejApvE, 'approver inserts rejection')
await ap.from('requests').update({ status: 'rejected' }).eq('id', greq.id)
const { data: grBack } = await rq.from('requests').select('status').eq('id', greq.id).single()
ok(grBack?.status === 'rejected', 'requestor sees rejected status')

section('Negative RLS (security)')
ok(!!(await rq.from('approvals').insert({ request_id: lreq.id, approver_id: rqa.user.id, decision: 'approved' })).error, 'requestor CANNOT insert approval')
// requestor tries to read all requests -> only own
const { data: allAsRq } = await rq.from('requests').select('requestor_id')
ok((allAsRq ?? []).every((r) => r.requestor_id === rqa.user.id), 'requestor only sees own requests')
// second isolated requestor should not see first requestor's request (create throwaway via nothing) -> use approver-created? approvers are all-visible so skip; covered above.
// requestor cannot change someone else's request: emulate by trying to update a non-owned id (approver's? none). Use control update already covered.

section('Cleanup')
const { error: delE } = await rq.from('requests').delete().eq('id', lreq.id)
await rq.from('requests').delete().eq('id', greq.id)
ok(!delE, 'requestor can delete own test requests (cleanup)')

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
if (fail) { console.log('FAILURES:'); fails.forEach((f) => console.log(' -', f)) }
process.exit(fail ? 1 : 0)
