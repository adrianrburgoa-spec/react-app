// Integration check against the configured project. Creates two temporary
// confirmed users without sending emails and removes their rows/users afterward.
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium, expect } from '@playwright/test'
import { preview } from 'vite'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY
if (!url || !key || !serviceKey) throw Error('Missing test environment configuration.')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, options)
const anonymous = createClient(url, key, options)
const users = []
let browser, server
const tables = ['payments', 'appointments', 'clients', 'studio_settings']
const check = (condition, message) => { if (!condition) throw Error(message) }
const success = (result, message) => { check(!result.error, message); return result.data }

try {
  for (let index = 0; index < 2; index++) {
    const email = `inkstudio-check-${randomUUID()}@example.invalid`
    const password = `${randomUUID()}Aa9!`
    const created = success(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'Could not create isolated test user.')
    const user = { id: created.user.id, email, password, api: createClient(url, key, options) }
    users.push(user)
    success(await user.api.auth.signInWithPassword({ email, password }), 'Could not sign in test user.')
  }
  const [owner, stranger] = users
  const clientId = randomUUID()
  const appointmentId = randomUUID()
  const paymentId = randomUUID()
  const rows = {
    clients: { id: clientId, name: 'Cliente API temporal', artist: 'Diego Arnez', ci: randomUUID() },
    appointments: { id: appointmentId, client_id: clientId, date: '2026-12-20', time: '10:00', artist: 'Diego Arnez', type: 'Blackwork custom', status: 'Confirmada' },
    payments: { id: paymentId, client_id: clientId, date: '2026-12-20', amount: 45.5, method: 'QR', concept: 'Prueba temporal' },
    studio_settings: { name: 'Administrador temporal', studio: 'Estudio de prueba', address: 'Dirección temporal' },
  }
  for (const table of ['clients', 'appointments', 'payments', 'studio_settings']) {
    success(await owner.api.from(table).insert(rows[table]).select().single(), `Owner insert failed: ${table}`)
    const selector = table === 'studio_settings' ? 'owner_id' : 'id'
    const id = table === 'studio_settings' ? owner.id : rows[table].id
    const unauthenticated = await anonymous.from(table).select('*')
    check(unauthenticated.error || unauthenticated.data.length === 0, `Anonymous read allowed: ${table}`)
    const hidden = success(await stranger.api.from(table).select('*').eq(selector, id), `Cross-account read failed unexpectedly: ${table}`)
    check(hidden.length === 0, `Cross-account data exposed: ${table}`)
    const changes = table === 'clients' ? { name: 'Forbidden' } : table === 'appointments' ? { notes: 'Forbidden' } : table === 'payments' ? { concept: 'Forbidden' } : { studio: 'Forbidden' }
    const deniedUpdate = await stranger.api.from(table).update(changes).eq(selector, id).select()
    check(deniedUpdate.error || deniedUpdate.data.length === 0, `Cross-account update allowed: ${table}`)
    const deniedDelete = await stranger.api.from(table).delete().eq(selector, id).select()
    check(deniedDelete.error || deniedDelete.data.length === 0, `Cross-account delete allowed: ${table}`)
    const forged = { ...rows[table], owner_id: owner.id }
    if (table !== 'studio_settings') forged.id = randomUUID()
    check((await stranger.api.from(table).insert(forged)).error, `Cross-account insert allowed: ${table}`)
  }
  check((await owner.api.from('payments').insert({ ...rows.payments, id: randomUUID(), amount: -1 })).error, 'Negative payment accepted.')
  check((await owner.api.from('appointments').insert({ ...rows.appointments, id: randomUUID() })).error, 'Duplicate artist/time accepted.')
  check((await stranger.api.from('payments').insert({ ...rows.payments, id: randomUUID() })).error, 'Cross-account client relationship accepted.')
  check((await owner.api.from('clients').delete().eq('id', clientId)).error, 'Client with dependent rows was deleted.')
  console.log('PASS: owner CRUD permissions, RLS isolation on all four tables, anonymous access denied, constraints and cross-account foreign keys.')

  server = await preview({ configFile: false, base: '/react-app/', preview: { host: '127.0.0.1', port: 4179, strictPort: true } })
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  browser = await chromium.launch({ headless: true, ...(existsSync(chrome) ? { executablePath: chrome } : {}) })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto('http://127.0.0.1:4179/react-app/')
  await page.getByLabel('Correo electrónico').fill(owner.email)
  await page.getByLabel('Contraseña').fill(owner.password)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Estudio de prueba')
  await page.getByRole('button', { name: 'Clientes CRM', exact: true }).click()
  await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click()
  await page.getByLabel('Nombre completo').fill('Cliente navegador temporal')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Clientes CRM', exact: true }).click()
  await expect(page.locator('.client-row')).toHaveCount(2)
  const savedClients = success(await owner.api.from('clients').select('*'), 'Could not read browser-created client.')
  const browserClient = savedClients.find(row => row.name === 'Cliente navegador temporal')
  check(browserClient, 'Browser client did not persist remotely.')
  await page.locator('.client-row').filter({ hasText: 'Cliente navegador temporal' }).click()
  await page.getByLabel('Teléfono', { exact: true }).fill('70000000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('.client-row').filter({ hasText: 'Cliente navegador temporal' }).click()
  success(await owner.api.from('clients').update({ phone: '71111111' }).eq('id', browserClient.id), 'Could not simulate a concurrent edit.')
  await page.getByLabel('Teléfono', { exact: true }).fill('72222222')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Este registro cambió en otra sesión.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click()
  await expect(page.locator('.client-row').filter({ hasText: 'Cliente navegador temporal' })).toContainText('71111111')
  await page.getByRole('button', { name: 'Agenda y citas', exact: true }).click()
  await page.getByRole('button', { name: 'Registrar cita', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Fecha').fill('2026-12-21')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('Fecha', { exact: true }).fill('2026-12-21')
  await expect(page.locator('.schedule-card')).toHaveCount(1)
  await page.locator('.schedule-card').click()
  await page.getByRole('combobox', { name: 'Estado', exact: true }).click()
  await page.getByRole('option', { name: 'Completada', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.locator('.schedule-card')).toContainText('Completada')
  await page.getByRole('button', { name: 'Pagos y caja', exact: true }).click()
  await page.getByRole('button', { name: 'Registrar pago', exact: true }).click()
  await page.getByLabel('Importe (Bs.)').fill('123.45')
  await page.getByLabel('Concepto').fill('Pago de navegador temporal')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const paymentRow = page.locator('.client-row').filter({ hasText: 'Pago de navegador temporal' })
  await expect(paymentRow).toBeVisible()
  await paymentRow.click()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click()
  await expect(paymentRow).toHaveCount(0)
  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await page.getByLabel('Nombre del estudio').fill('Estudio actualizado')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const settings = success(await owner.api.from('studio_settings').select('studio').single(), 'Could not read saved settings.')
  check(settings.studio === 'Estudio actualizado', 'Settings did not persist.')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible()
  await page.getByLabel('Correo electrónico').fill(stranger.email)
  await page.getByLabel('Contraseña').fill(stranger.password)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.getByRole('button', { name: 'Clientes CRM', exact: true }).click()
  await expect(page.locator('.client-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await page.getByLabel('Nombre del estudio').fill('Segundo estudio')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  check(!pageErrors.length, 'Browser JavaScript errors occurred.')
  console.log('PASS: browser login, cloud client/appointment/payment/settings CRUD, reload persistence, concurrent edit protection, sign-out and account isolation.')
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => server.httpServer.close(resolve))
  let failed = false
  for (const user of users) {
    for (const table of tables) {
      const result = await admin.from(table).delete().eq('owner_id', user.id)
      if (result.error) failed = true
    }
    const result = await admin.auth.admin.deleteUser(user.id)
    if (result.error) failed = true
  }
  check(!failed, 'Temporary test cleanup failed. Check test users in Supabase.')
  console.log('Temporary test users and records removed.')
}
