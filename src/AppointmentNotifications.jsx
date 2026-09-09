import { Alert, Button } from '@mui/material'

export default function AppointmentNotifications({ appointments, clients, scope, saving, onConfirm, onRefresh, error }) {
  const pending = appointments.filter(item => item.status === 'Pendiente').sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  return <div className="form-fields"><p>{pending.length} citas pendientes de confirmación.</p><p className="text-sm text-slate-400">Contacta al cliente por tu cuenta y confirma aquí cuando haya aceptado la cita.</p>{error && <Alert severity="error">{error}</Alert>}{onRefresh && <Button disabled={saving} onClick={onRefresh}>Actualizar notificaciones</Button>}{!pending.length && <Alert severity="success">Todas las citas están confirmadas o resueltas.</Alert>}{pending.map(item => {
    const canConfirm = !scope || scope.role === 'admin' || scope.artist === item.artist
    return <section className="surface" key={item.id}><strong>{clients.find(client => client.id === item.clientId)?.name || 'Cliente'}</strong><p className="text-sm text-slate-400">{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-BO')} · {item.time} · {item.artist}</p><p className="text-sm text-slate-400">{clients.find(client => client.id === item.clientId)?.phone || 'Sin teléfono registrado'}</p>{canConfirm ? <Button disabled={saving} onClick={() => onConfirm(item)}>Confirmar cita</Button> : <p className="text-xs text-slate-500">La confirma el tatuador asignado o un administrador.</p>}</section>
  })}</div>
}
