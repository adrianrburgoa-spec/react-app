import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null

export const defaultSettings = { name: 'Administrador', studio: 'InkStudio CBBA', address: 'Cochabamba, Bolivia' }
const fields = {
  artists: ['name', 'active'],
  clients: ['name', 'phone', 'email', 'ci', 'tag', 'artist'],
  appointments: ['date', 'time', 'artist', 'type', 'status', 'notes', 'total_price'],
  payments: ['amount', 'method', 'date', 'concept'],
  studio_settings: ['name', 'studio', 'address'],
}
function fromRow(table, row) {
  const record = Object.fromEntries(fields[table].map(key => [key, row[key]]))
  if (table !== 'studio_settings') record.id = row.id
  if (table === 'appointments') record.time = row.time.slice(0, 5)
  if (table === 'appointments') record.total_price = Number(row.total_price)
  if (table === 'payments') record.amount = Number(row.amount)
  if (row.client_id) record.clientId = row.client_id
  if (row.appointment_id) record.appointmentId = row.appointment_id
  record._updatedAt = row.updated_at
  return record
}
function toRow(table, record, ownerId) {
  const row = Object.fromEntries(fields[table].map(key => [key, record[key]]))
  row.owner_id = ownerId
  if (table !== 'studio_settings') row.id = record.id
  if (record.clientId) row.client_id = record.clientId
  if (table === 'payments') row.appointment_id = record.appointmentId || null
  return row
}
export function databaseError(error) {
  if (error.code === '23505') return 'Ya existe un registro con ese CI u horario. Actualiza los datos y revisa el formulario.'
  if (error.code === '23503') return 'El registro está relacionado con otros datos. Actualiza la página y revisa las citas y pagos del cliente.'
  if (error.code === 'PGRST116') return 'Este registro cambió en otra sesión. Cierra el formulario, actualiza los datos y vuelve a intentarlo.'
  if (error.code === '42501' || error.status === 401) return 'No tienes permiso para esta acción. Vuelve a iniciar sesión.'
  if (error.code === '23514') return 'Revisa los campos: uno de los valores no es válido.'
  return 'No se pudo completar la operación en Supabase. Comprueba tu conexión e inténtalo de nuevo.'
}
export async function fetchStudio(ownerId) {
  const { data: role, error: roleError } = await supabase.rpc('studio_role', { studio_id: ownerId })
  if (roleError) throw roleError
  if (!role) throw { code: '42501' }
  // Page through every table instead of silently truncating at the API row limit.
  const entries = await Promise.all(Object.keys(fields).map(async table => {
    if (table === 'payments' && role !== 'admin') return ['payments', []]
    const rows = []
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from(table).select('*').eq('owner_id', ownerId).order(table === 'studio_settings' ? 'owner_id' : 'id').range(start, start + 499)
      if (error) throw error
      rows.push(...data.map(row => fromRow(table, row)))
      if (data.length < 500) break
    }
    return [table === 'studio_settings' ? 'settings' : table, table === 'studio_settings' ? rows[0] || { ...defaultSettings } : rows]
  }))
  return Object.fromEntries(entries)
}
export async function persistStudioChange(previous, next, ownerId) {
  const { data: role, error: roleError } = await supabase.rpc('studio_role', { studio_id: ownerId })
  if (roleError) throw roleError
  if (!role) throw { code: '42501' }
  // Save only the edited record. Timestamp matching detects concurrent edits.
  for (const table of Object.keys(fields)) {
    const key = table === 'studio_settings' ? 'settings' : table
    if (previous[key] === next[key]) continue
    const oldRows = key === 'settings' ? [previous.settings] : previous[key]
    const newRows = key === 'settings' ? [next.settings] : next[key]
    const record = newRows.find(row => !oldRows.some(old => old.id === row.id && old === row))
    const deleted = oldRows.find(row => !newRows.some(item => item.id === row.id))
    const old = record && oldRows.find(row => row.id === record.id)
    if (role === 'artist') {
      if (table !== 'appointments' || !old || deleted) throw { code: '42501' }
      const { data, error } = await supabase.rpc('update_artist_appointment', {
        appointment_id: record.id, expected_version: old._updatedAt, new_status: record.status, new_notes: record.notes,
      })
      if (error) throw error
      const saved = fromRow(table, data)
      return { ...next, appointments: newRows.map(row => row.id === saved.id ? saved : row) }
    }
    let query
    if (deleted) query = supabase.from(table).delete().eq('id', deleted.id).eq('updated_at', deleted._updatedAt)
    else if (old?._updatedAt) query = supabase.from(table).update(toRow(table, record, ownerId)).eq(key === 'settings' ? 'owner_id' : 'id', key === 'settings' ? ownerId : record.id).eq('updated_at', old._updatedAt)
    else query = supabase.from(table).insert(toRow(table, record, ownerId))
    const { data, error } = await query.select().single()
    if (error) throw error
    if (deleted) return next
    const saved = fromRow(table, data)
    return { ...next, [key]: key === 'settings' ? saved : newRows.map(row => row.id === saved.id ? saved : row) }
  }
  return next
}

export async function createClientAppointment(client, appointment, ownerId) {
  const { data, error } = await supabase.rpc('create_client_appointment', {
    studio_id: ownerId,
    new_client_name: client.name,
    new_client_phone: client.phone,
    new_client_email: client.email,
    new_client_ci: client.ci,
    new_client_tag: client.tag,
    new_client_artist: client.artist,
    new_appointment_date: appointment.date,
    new_appointment_time: appointment.time,
    new_appointment_artist: appointment.artist,
    new_appointment_type: appointment.type,
    new_appointment_status: appointment.status,
    new_appointment_notes: appointment.notes,
    new_appointment_total_price: appointment.total_price,
  })
  if (error) throw error
  return {
    client: fromRow('clients', data.client),
    appointment: fromRow('appointments', data.appointment),
  }
}
