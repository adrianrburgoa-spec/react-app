import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium, expect } from '@playwright/test'
import { preview } from 'vite'
const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!process.env.SUPABASE_TEST_SERVICE_KEY) throw Error('Missing test admin key.')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, process.env.SUPABASE_TEST_SERVICE_KEY, options)
const users = []
const check = (condition, message) => { if (!condition) throw Error(message) }
const ok = (result, message) => { if (result.error) throw Error(`${message} (${result.error.code || result.error.message})`); return result.data }
let browser, server
try {
  for (let i=0;i<2;i++) {
    const email=`team-check-${randomUUID()}@example.invalid`,password=`Aa9!${randomUUID()}`
    const created=ok(await admin.auth.admin.createUser({email,password,email_confirm:true}),'create temporary owner')
    const user={id:created.user.id,email,password,api:createClient(url,key,options)};users.push(user)
    ok(await user.api.auth.signInWithPassword({email,password}),'login')
  }
  const [owner,outsider]=users
  ok(await owner.api.from('studio_settings').insert({name:'Owner',studio:'Equipo temporal',address:'Cochabamba'}),'settings')
  const client=ok(await owner.api.from('clients').insert({name:'Cliente de equipo',artist:'Diego Arnez'}).select().single(),'client')
  const appointment=ok(await owner.api.from('appointments').insert({client_id:client.id,date:'2026-12-28',time:'10:00',artist:'Diego Arnez',type:'Blackwork custom',status:'Pendiente'}).select().single(),'appointment')
  const another=ok(await owner.api.from('appointments').insert({client_id:client.id,date:'2026-12-28',time:'12:00',artist:'Lucas Méndez',type:'Blackwork custom',status:'Pendiente'}).select().single(),'other appointment')
  ok(await owner.api.from('payments').insert({client_id:client.id,date:'2026-12-28',amount:50,method:'Efectivo',concept:'Test'}),'payment')
  const staffResult=await owner.api.functions.invoke('studio-staff',{body:{ownerId:owner.id,username:`check-${randomUUID().slice(0,8)}`,role:'artist',artist:'Diego Arnez'}})
  if(staffResult.error) {
    let message='';try{message=await staffResult.error.context.text()}catch{}
    throw Error(`Staff function rejected test: ${message}`)
  }
  check(staffResult.data.email&&staffResult.data.password,'staff credentials not returned')
  const staff={...staffResult.data,api:createClient(url,key,options)}
  const staffSession=ok(await staff.api.auth.signInWithPassword({email:staff.email,password:staff.password}),'staff login')
  staff.id=staffSession.user.id;users.push(staff)
  check(ok(await staff.api.rpc('studio_role',{studio_id:owner.id}),'role')==='artist','wrong role')
  check(ok(await staff.api.from('clients').select('id').eq('owner_id',owner.id),'shared clients').length===1,'missing shared client')
  check(ok(await staff.api.from('payments').select('*').eq('owner_id',owner.id),'private payments').length===0,'artist accessed payments')
  const edit=await staff.api.from('clients').update({name:'Forbidden'}).eq('id',client.id).select()
  check(edit.error||edit.data.length===0,'artist modified client')
  check((await staff.api.rpc('create_studio_invite',{studio_id:owner.id,member_role:'admin'})).error,'artist can invite admin')
  check((await outsider.api.rpc('list_studio_members',{studio_id:owner.id})).error,'outsider can list emails')
  const direct=await staff.api.from('appointments').update({artist:'Lucas Méndez'}).eq('id',appointment.id).select()
  check(direct.error||!direct.data.length,'artist changed assignment')
  check((await staff.api.rpc('update_artist_appointment',{appointment_id:another.id,expected_version:another.updated_at,new_status:'Confirmada',new_notes:''})).error,'artist modified other artist appointment')
  const updated=ok(await staff.api.rpc('update_artist_appointment',{appointment_id:appointment.id,expected_version:appointment.updated_at,new_status:'Pendiente',new_notes:'Nota del tatuador'}),'artist own update')
  check(updated.notes==='Nota del tatuador','notes missing')
  const invite=ok(await owner.api.rpc('create_studio_invite',{studio_id:owner.id,member_role:'admin'}),'invite')
  ok(await outsider.api.rpc('accept_studio_invite',{invite_code:invite}),'join')
  check((await outsider.api.rpc('accept_studio_invite',{invite_code:invite})).error,'invite reused')
  check(ok(await outsider.api.from('payments').select('id').eq('owner_id',owner.id),'shared admin payments').length===1,'admin missing payments')
  ok(await owner.api.from('studio_members').delete().eq('owner_id',owner.id).eq('user_id',outsider.id),'revoke')
  check(ok(await outsider.api.from('payments').select('id').eq('owner_id',owner.id),'revoked read').length===0,'revoked member retains access')
  console.log('PASS: staff provisioning, team sharing, protected finances, role escalation blocked, assigned appointment updates, single-use invite and revocation.')
  server=await preview({configFile:false,base:'/react-app/',preview:{host:'127.0.0.1',port:4179,strictPort:true}})
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:4179/react-app/')
  await page.getByLabel('Correo electrónico').fill(staff.email)
  await page.getByLabel('Contraseña').fill(staff.password)
  await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()
  await expect(page.getByRole('heading',{level:1})).toContainText('Agenda')
  await expect(page.getByRole('button',{name:'Pagos y caja',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Equipo y permisos',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Ver notificaciones',exact:true}).click()
  await expect(page.getByRole('button',{name:'Confirmar cita',exact:true})).toHaveCount(1)
  await page.getByRole('button',{name:'Confirmar cita',exact:true}).click()
  await expect(page.getByRole('button',{name:'Confirmar cita',exact:true})).toHaveCount(0)
  check(ok(await owner.api.from('appointments').select('status').eq('id',appointment.id).single(),'confirmed').status==='Confirmada','notification confirmation not saved')
  await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click()
  await page.getByRole('button',{name:'Mi cuenta',exact:true}).click()
  await expect(page.getByText('Puedes seguir usando tu cuenta actual.',{exact:false})).toBeVisible()
  const password=`Updated9!${randomUUID()}`
  await page.getByLabel('Contraseña actual').fill(staff.password)
  await page.getByLabel('Nueva contraseña',{exact:true}).fill(password)
  await page.getByLabel('Repetir nueva contraseña').fill(password)
  await page.getByRole('button',{name:'Actualizar acceso',exact:true}).click()
  await expect(page.getByText('Contraseña actualizada.',{exact:false})).toBeVisible()
  const newSession=createClient(url,key,options)
  ok(await newSession.auth.signInWithPassword({email:staff.email,password}),'new password login')
  await newSession.auth.signOut({scope:'local'})
  await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click()
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click()
  await page.getByLabel('Correo electrónico').fill(owner.email)
  await page.getByLabel('Contraseña').fill(owner.password)
  await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()
  await page.getByRole('button',{name:'Equipo y permisos',exact:true}).click()
  await expect(page.getByText(staff.email,{exact:true})).toBeVisible()
  check(errors.length===0,'Browser runtime errors')
  console.log('PASS: artist UI, internal notification confirmation, password change, administrator team panel; no outgoing messages.')
} finally {
  await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve))
  let failed=false
  for(const user of users){
    for(const table of ['studio_invites','studio_members','payments','appointments','clients','studio_settings']){
      const result=await admin.from(table).delete().eq('owner_id',user.id);if(result.error)failed=true
    }
    const result=await admin.auth.admin.deleteUser(user.id);if(result.error)failed=true
  }
  check(!failed,'Temporary test cleanup failed')
  console.log('Temporary accounts and test data removed.')
}
