import { createClient } from '@supabase/supabase-js'

const url = 'https://owfyawpxydjkmitookfp.supabase.co'
const anon = 'sb_publishable_VbXaWcuRIvZsu2jQnsEPmg_WGcabzqg'
const supabase = createClient(url, anon)

const users = [
  { email: 'requestor@ichub.com', password: 'Passw0rd!', full_name: 'Riya Requestor', role: 'requestor' },
  { email: 'approver@ichub.com', password: 'Passw0rd!', full_name: 'Anil Approver', role: 'approver' },
]

for (const u of users) {
  const { data, error } = await supabase.auth.signUp({
    email: u.email,
    password: u.password,
    options: { data: { full_name: u.full_name, role: u.role } },
  })
  if (error) console.log(`signup ${u.email}: ${error.message}`)
  else console.log(`signup ${u.email}: ok (id=${data.user?.id})`)
}
