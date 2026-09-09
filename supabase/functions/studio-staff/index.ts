import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return reply({ error: 'Método no permitido.' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply({ error: 'Inicia sesión.' }, 401)
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return reply({ error: 'Sesión inválida.' }, 401)
  try {
    const { ownerId, username, role, artist } = await request.json()
    if (typeof ownerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(ownerId) || typeof username !== 'string' || !/^[a-z0-9-]{3,30}$/.test(username) || !['admin','artist'].includes(role) || (role === 'artist' && !['Diego Arnez','Lucas Méndez','Sofía Rojas'].includes(artist))) return reply({ error: 'Datos de cuenta inválidos.' }, 400)
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const permission = await caller.rpc('studio_role', { studio_id: ownerId })
    if (permission.error || permission.data !== 'admin') return reply({ error: 'Solo un administrador puede crear cuentas del equipo.' }, 403)
    const email = `${username}.${ownerId.slice(0,8)}@inkstudio.example`
    const password = `Ink!${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2,'0')).join('')}a9`
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) return reply({ error: 'Ese nombre de usuario ya existe o no se pudo crear la cuenta.' }, 409)
    const membership = await admin.from('studio_members').insert({ owner_id: ownerId, user_id: created.data.user.id, role, artist: role === 'artist' ? artist : null })
    if (membership.error) {
      await admin.auth.admin.deleteUser(created.data.user.id)
      return reply({ error: 'No se pudo asignar la cuenta al estudio.' }, 500)
    }
    return reply({ email, password })
  } catch { return reply({ error: 'No se pudo procesar la solicitud.' }, 400) }
})
