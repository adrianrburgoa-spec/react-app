import { useRef, useState } from 'react'
import { databaseError } from './supabase.js'
import AppointmentNotifications from './AppointmentNotifications.jsx'
import { AddCircle, Analytics, CalendarMonth, ChevronRight, Dashboard as DashboardIcon, Download, EventAvailable, Groups, Menu, NotificationsNone, Payments as PaymentsIcon, Search, Settings, Verified, Wallet } from '@mui/icons-material'
import { Alert, Avatar, Badge, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, InputAdornment, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Snackbar, TextField, Tooltip } from '@mui/material'
import './App.css'

const navItems = [
  { id: 'dashboard', label: 'Panel principal', icon: DashboardIcon },
  { id: 'agenda', label: 'Agenda y citas', icon: CalendarMonth },
  { id: 'clientes', label: 'Clientes CRM', icon: Groups },
  { id: 'pagos', label: 'Pagos y caja', icon: PaymentsIcon },
]
const defaultArtists = ['Diego Arnez', 'Lucas Méndez', 'Sofía Rojas']
const styles = ['Blackwork custom', 'Fine line / minimal', 'Realismo & sombras', 'Cover-up / restauro']
const statuses = ['Pendiente', 'Confirmada', 'En proceso', 'Completada', 'Cancelada']
const emptyClient = (artist = defaultArtists[0]) => ({ name: '', phone: '', email: '', ci: '', tag: 'Nueva', artist })
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const money = value => `Bs. ${Number(value).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const prettyDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const storageKey = 'inkstudio-data-v1'
function initialData() {
  const clients = ['Camila Andrea Torrico', 'Rodrigo Villarroel Arce', 'Mariana Ferrufino', 'Sebastián Quiroga'].map((name, i) => ({ id: `c${i}`, name, phone: '', email: '', ci: '', tag: i === 0 ? 'VIP' : i === 2 ? 'Nueva' : 'Activo', artist: defaultArtists[i % 3] }))
  const artists = defaultArtists.map((name, index) => ({ id: `artist-${index}`, name, active: true }))
  return { artists, clients, appointments: clients.map((client, i) => ({ id: `a${i}`, clientId: client.id, date: dateKey(), time: ['10:00', '12:30', '15:00', '17:30'][i], artist: defaultArtists[i % 3], type: styles[i], status: ['En proceso', 'Confirmada', 'Pendiente', 'Confirmada'][i], notes: '', total_price: 0 })), payments: [], settings: { name: 'Adrián R.', studio: 'InkStudio CBBA', address: 'Sede América Oeste #842, Cochabamba' } }
}
function loadData() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey))
    if (data && ['clients', 'appointments', 'payments'].every(key => Array.isArray(data[key])) && data.settings) return { ...data, artists: data.artists || defaultArtists.map((name, index) => ({ id: `artist-${index}`, name, active: true })) }
  } catch { /* Fall back to the example data when storage is unavailable. */ }
  return initialData()
}
function Surface({ children, className = '' }) { return <section className={`surface ${className}`}>{children}</section> }
function StatusChip({ label }) {
  const color = label === 'Cancelada' ? '#ff7186' : ['Confirmada', 'Completada', 'Activo'].includes(label) ? '#54ea7e' : label === 'Pendiente' || label === 'Nueva' ? '#4cd7f6' : '#ffc665'
  return <Chip label={label} size="small" sx={{ color, bgcolor: `${color}18`, border: `1px solid ${color}35` }} />
}
function Field({ label, name, value, onChange, options, ...props }) {
  return <TextField fullWidth label={label} name={name} value={value ?? ''} onChange={event => onChange(name, event.target.value)} select={Boolean(options)} slotProps={{ inputLabel: { shrink: true } }} {...props}>{options?.map(option => <MenuItem key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</MenuItem>)}</TextField>
}
function App({ initial, cloud = false, onPersist, onCreateClientAppointment, onRefresh, onSignOut, scope, toolbar }) {
  const isAdmin = !scope || scope.role === 'admin'
  const [data, setData] = useState(() => initial || loadData())
  const activeArtists = (data.artists || []).filter(artist => artist.active).map(artist => artist.name)
  const agendaArtists = [...new Set([...activeArtists, ...data.appointments.map(appointment => appointment.artist)])]
  const [saving, setSaving] = useState(false)
  const busyRef = useRef(false)
  const [active, setActive] = useState(isAdmin ? 'dashboard' : 'agenda')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [date, setDate] = useState(dateKey)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [period, setPeriod] = useState('Meses')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState({})
  const [newClient, setNewClient] = useState(emptyClient)
  const [useNewClient, setUseNewClient] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const today = dateKey()
  const clientName = id => data.clients.find(client => client.id === id)?.name || 'Cliente no disponible'
  const navigate = id => { if (!isAdmin && id === 'pagos') return; setActive(id); setMobileOpen(false) }
  const saveData = async next => {
    if (busyRef.current) return false
    busyRef.current = true; setSaving(true)
    try {
      if (cloud) setData(await onPersist(data, next))
      else { localStorage.setItem(storageKey, JSON.stringify(next)); setData(next) }
      return true
    } catch (cause) {
      setError(cloud ? databaseError(cause) : 'No se pudo guardar en el navegador. Revisa el espacio disponible y los permisos de almacenamiento.')
      return false
    } finally { busyRef.current = false; setSaving(false) }
  }
  const close = () => { if (busyRef.current) return; setDialog(null); setError(''); setConfirmDelete(false) }
  const refresh = async () => {
    if (busyRef.current) return
    busyRef.current = true; setSaving(true)
    try { setData(await onRefresh()); setNotice('Datos actualizados') }
    catch (cause) { setNotice(databaseError(cause)) }
    finally { busyRef.current = false; setSaving(false) }
  }
  const open = (kind, record) => {
    if (!isAdmin && (kind === 'payment' || kind === 'settings' || (kind === 'appointment' && !record))) return;
    setError(''); setConfirmDelete(false); setDialog(kind === 'appointment' && record?.id ? 'appointment-details' : kind)
    setUseNewClient(kind === 'appointment' && !record && !data.clients.length)
    setNewClient(emptyClient(activeArtists[0]))
    setForm(record ? { ...record } : kind === 'appointment' ? { clientId: data.clients[0]?.id || '', date: active === 'agenda' ? date : today, time: '10:00', artist: activeArtists[0] || '', type: styles[0], status: 'Pendiente', notes: '', total_price: '' } : kind === 'client' ? emptyClient(activeArtists[0]) : kind === 'payment' ? { clientId: data.clients[0]?.id || '', appointmentId: '', amount: '', method: 'Efectivo', date: today, concept: '' } : kind === 'settings' ? { ...data.settings } : {})
  }
  const change = (name, value) => setForm(previous => ({ ...previous, [name]: value, ...(dialog === 'payment' && name === 'clientId' ? { appointmentId: '' } : {}) }))
  const changeNewClient = (name, value) => setNewClient(previous => ({ ...previous, [name]: value }))
  const submit = async event => {
    event.preventDefault()
    if (busyRef.current) return
    if (!isAdmin && (dialog !== 'appointment' || !form.id || form.artist !== scope.artist)) return setError('No tienes permiso para modificar este registro.');
    const record = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
    if (dialog === 'settings') {
      if (!record.name || !record.studio || !record.address) return setError('Completa todos los campos.')
      if (await saveData({ ...data, settings: record })) { close(); setNotice('Configuración guardada') }
      return
    }
    if (dialog === 'client' && !record.name) return setError('Escribe el nombre del cliente.')
    if (dialog === 'client' && record.ci && data.clients.some(client => client.id !== record.id && client.ci === record.ci)) return setError('Ya existe un cliente con ese CI.')
    const creatingClientWithAppointment = dialog === 'appointment' && !record.id && useNewClient
    if (creatingClientWithAppointment && !newClient.name.trim()) return setError('Escribe el nombre del cliente nuevo.')
    if (creatingClientWithAppointment && newClient.ci.trim() && data.clients.some(client => client.ci === newClient.ci.trim())) return setError('Ya existe un cliente con ese CI. Selecciónalo como cliente registrado.')
    if (['appointment', 'payment'].includes(dialog) && !creatingClientWithAppointment && !data.clients.some(client => client.id === record.clientId)) return setError('Selecciona un cliente válido.')
    if (dialog === 'appointment') {
      record.total_price = Number(record.total_price || 0)
      if (!record.date || !record.time) return setError('Indica la fecha y la hora.')
      if (!Number.isFinite(record.total_price) || record.total_price < 0) return setError('El precio total no puede ser negativo.')
      if (record.status !== 'Cancelada' && data.appointments.some(item => item.id !== record.id && item.date === record.date && item.time === record.time && item.artist === record.artist && item.status !== 'Cancelada')) return setError('El artista ya tiene una cita a esa hora. Elige otro horario.')
    }
    if (dialog === 'payment') {
      record.amount = Number(record.amount)
      if (!Number.isFinite(record.amount) || record.amount <= 0 || !record.date || !record.concept) return setError('Indica un importe mayor que cero, fecha y concepto.')
      if (record.appointmentId && !data.appointments.some(item => item.id === record.appointmentId && item.clientId === record.clientId)) return setError('La cita seleccionada no corresponde a este cliente.')
    }
    if (creatingClientWithAppointment) {
      const client = Object.fromEntries(Object.entries(newClient).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
      if (cloud) {
        busyRef.current = true; setSaving(true)
        let saved
        try {
          saved = await onCreateClientAppointment(client, record)
          setData(previous => ({ ...previous, clients: [...previous.clients, saved.client], appointments: [...previous.appointments, saved.appointment] }))
        } catch (cause) { setError(databaseError(cause)) }
        finally { busyRef.current = false; setSaving(false) }
        if (saved) { close(); setNotice('Cliente y cita registrados correctamente') }
        return
      }
      client.id = crypto.randomUUID(); record.id = crypto.randomUUID(); record.clientId = client.id
      if (await saveData({ ...data, clients: [...data.clients, client], appointments: [...data.appointments, record] })) { close(); setNotice('Cliente y cita registrados correctamente') }
      return
    }
    const key = { client: 'clients', appointment: 'appointments', payment: 'payments' }[dialog]
    record.id ||= crypto.randomUUID()
    const exists = data[key].some(item => item.id === record.id)
    const next = { ...data, [key]: exists ? data[key].map(item => item.id === record.id ? record : item) : [...data[key], record] }
    if (await saveData(next)) { close(); setNotice(exists ? 'Cambios guardados' : 'Registro creado') }
  }
  const remove = async () => {
    if (!isAdmin) return;
    if (busyRef.current) return
    if (dialog === 'client' && (data.appointments.some(item => item.clientId === form.id) || data.payments.some(item => item.clientId === form.id))) { setConfirmDelete(false); return setError('Este cliente tiene citas o pagos asociados. Elimina esos registros antes de eliminarlo.') }
    const key = { client: 'clients', appointment: 'appointments', payment: 'payments' }[dialog]
    if (await saveData({ ...data, [key]: data[key].filter(item => item.id !== form.id) })) { close(); setNotice('Registro eliminado') }
  }
  const saveAppointmentNote = async () => {
    if (!isAdmin && form.artist !== scope?.artist) return setError('No tienes permiso para modificar las notas de esta cita.')
    const next = { ...data, appointments: data.appointments.map(item => item.id === form.id ? { ...item, notes: (form.notes || '').trim() } : item) }
    if (await saveData(next)) { close(); setNotice('Nota de la cita actualizada') }
  }
  const shiftDay = amount => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + amount); setDate(dateKey(next)) }
  const appointmentsOn = day => data.appointments.filter(item => item.date === day).sort((a, b) => a.time.localeCompare(b.time))
  const todayAppointments = appointmentsOn(today)
  const upcomingAppointments = data.appointments.filter(item => item.date > today && item.status !== 'Cancelada').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const visibleClients = data.clients.filter(client => normalized([client.name, client.phone, client.email, client.ci].join(' ')).includes(normalized(query)) && (filter === 'Todos' || filter === 'Clientes frecuentes' && (client.tag === 'VIP' || data.appointments.filter(item => item.clientId === client.id && item.status === 'Completada').length >= 2) || filter === 'Citas pendientes' && data.appointments.some(item => item.clientId === client.id && ['Pendiente', 'Confirmada', 'En proceso'].includes(item.status))))
  const sum = payments => payments.reduce((total, payment) => total + payment.amount, 0)
  const appointmentPaid = id => sum(data.payments.filter(payment => payment.appointmentId === id))
  const appointmentBalance = appointment => Math.max(0, Number(appointment.total_price || 0) - appointmentPaid(appointment.id))
  const appointmentFinancialLabel = appointment => Number(appointment.total_price || 0) > 0 ? `Pagado ${money(appointmentPaid(appointment.id))} · Saldo ${money(appointmentBalance(appointment))}` : 'Precio sin definir'
  const outstandingBalance = data.appointments.filter(item => item.status !== 'Cancelada').reduce((total, item) => total + appointmentBalance(item), 0)
  const monthPayments = data.payments.filter(item => item.date.startsWith(today.slice(0, 7)))
  const dailyPayments = data.payments.filter(item => item.date === today)
  const download = () => {
    const records = active === 'clientes' ? visibleClients.map(item => ({ Nombre: item.name, Telefono: item.phone, Email: item.email, CI: item.ci, Estado: item.tag, Artista: item.artist })) : active === 'pagos' || active === 'dashboard' ? data.payments.map(item => ({ Fecha: item.date, Cliente: clientName(item.clientId), Cita: data.appointments.find(appointment => appointment.id === item.appointmentId)?.date || '', Importe_BOB: item.amount, Metodo: item.method, Concepto: item.concept })) : appointmentsOn(date).map(item => ({ Fecha: item.date, Hora: item.time, Cliente: clientName(item.clientId), Artista: item.artist, Estilo: item.type, Precio_BOB: item.total_price || 0, Pagado_BOB: appointmentPaid(item.id), Saldo_BOB: appointmentBalance(item), Estado: item.status }))
    if (!records.length) return setNotice('No hay registros para exportar en esta vista.')
    const escape = value => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`
    const csv = '\uFEFF' + [Object.keys(records[0]), ...records.map(Object.values)].map(row => row.map(escape).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `inkstudio-${active}-${active === 'agenda' ? date : today}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Reporte CSV descargado')
  }
  const chartBuckets = Array.from({ length: period === 'Meses' ? 12 : 7 }, (_, index) => {
    const day = new Date(`${today}T12:00:00`)
    if (period === 'Meses') day.setMonth(index, 1)
    else day.setDate(day.getDate() - 6 + index)
    const key = dateKey(day).slice(0, period === 'Meses' ? 7 : 10)
    return { label: day.toLocaleDateString('es-BO', period === 'Meses' ? { month: 'short' } : { weekday: 'short', day: 'numeric' }), value: sum(data.payments.filter(item => item.date.startsWith(key))) }
  })
  const maxChart = Math.max(1, ...chartBuckets.map(item => item.value))
  const chart = <><div className="panel-heading"><div><span className="eyebrow-text">INGRESOS REGISTRADOS · {new Date().getFullYear()}</span><h2>Resumen financiero y tendencia</h2></div><TextField select size="small" label="Periodo" value={period} onChange={event => setPeriod(event.target.value)}><MenuItem value="Meses">Meses</MenuItem><MenuItem value="Días">Últimos 7 días</MenuItem></TextField></div><div className="chart-area">{chartBuckets.map((item, index) => <Tooltip key={index} title={`${item.label}: ${money(item.value)}`}><div className="chart-bar-wrap" tabIndex={0} aria-label={`${item.label}: ${money(item.value)}`}><div className={`chart-bar ${item.value ? 'active' : ''}`} style={{ height: `${Math.max(1, item.value / maxChart * 85)}%` }} /><span>{item.label}</span></div></Tooltip>)}</div>{!chartBuckets.some(item => item.value) && <p className="text-sm text-slate-400 mt-3">Sin pagos registrados en este periodo.</p>}</>
  const appointmentList = items => <div className="appointment-list">{!items.length && <p className="empty-slot">No hay citas para esta fecha.</p>}{items.map(item => <button className="appointment-row interactive-row" key={item.id} onClick={() => open('appointment', item)}><span className="appointment-time">{item.time}</span><div className="appointment-client"><Avatar sx={{ bgcolor: '#32353c', color: '#ffc665' }}>{clientName(item.clientId)[0]}</Avatar><div><strong>{clientName(item.clientId)}</strong><span>{item.type} · {item.artist}</span><span>{appointmentFinancialLabel(item)}</span></div></div><StatusChip label={item.status} /></button>)}</div>
  const sidebar = <div className="flex h-full flex-col"><div className="brand-block"><div className="brand-mark">IS</div><div><div className="brand-name">INKSTUDIO</div><div className="brand-meta">CBBA · OPERACIONES</div></div></div><div className="px-4 pb-3 pt-8 mono-label text-slate-500">ESPACIO DE TRABAJO</div><List className="px-2">{navItems.filter(item => isAdmin || item.id !== 'pagos').map(({ id, label, icon: Icon }) => <ListItemButton key={id} selected={active === id} onClick={() => navigate(id)} className="nav-item"><ListItemIcon><Icon /></ListItemIcon><ListItemText primary={label} /></ListItemButton>)}</List><div className="mt-auto p-4"><div className="artist-card"><Avatar sx={{ bgcolor: '#e5a93c', color: '#432c00' }}>{data.settings.name.slice(0, 2).toUpperCase()}</Avatar><div className="min-w-0"><div className="truncate text-sm font-semibold">{data.settings.name}</div><div className="mono-label text-slate-500">{isAdmin ? 'Administrador' : 'Tatuador'}</div></div>{isAdmin && <IconButton aria-label="Configuración" onClick={() => open('settings')}><Settings fontSize="small" /></IconButton>}</div></div></div>
  const titles = { dashboard: `Panel principal — ${data.settings.studio}`, agenda: 'Agenda y gestión de citas', clientes: 'Directorio de clientes', pagos: 'Registro de pagos y caja diaria' }
  const action = active === 'clientes' ? 'client' : active === 'pagos' ? 'payment' : 'appointment'
  const metrics = active === 'pagos' ? [
    ['Ingresos de hoy', money(sum(dailyPayments)), PaymentsIcon], ['QR de hoy', money(sum(dailyPayments.filter(item => item.method === 'QR'))), Wallet], ['Efectivo de hoy', money(sum(dailyPayments.filter(item => item.method === 'Efectivo'))), PaymentsIcon], ['Transferencias de hoy', money(sum(dailyPayments.filter(item => item.method === 'Transferencia'))), Wallet], ['Ingresos del mes', money(sum(monthPayments)), Analytics], ['Saldo pendiente', money(outstandingBalance), Verified],
  ] : [
    ['Citas de hoy', todayAppointments.filter(item => item.status !== 'Cancelada').length, EventAvailable], ['Próximos 7 días', data.appointments.filter(item => item.date >= today && item.date < dateKey(new Date(new Date(`${today}T12:00:00`).getTime() + 7 * 86400000)) && item.status !== 'Cancelada').length, CalendarMonth], ['Clientes CRM', data.clients.length, Groups], ['Ingresos mes', money(sum(monthPayments)), PaymentsIcon], ['Citas pendientes', data.appointments.filter(item => item.status === 'Pendiente').length, Wallet], ['Completadas', data.appointments.filter(item => item.status === 'Completada').length, Verified],
  ]
  return <div className="app-frame"><Drawer variant="permanent" className="desktop-drawer" open slotProps={{ paper: { className: 'sidebar' } }}>{sidebar}</Drawer><Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} slotProps={{ paper: { className: 'sidebar' } }}>{sidebar}</Drawer><main className="main-content">{toolbar}<div className="mobile-topbar"><IconButton aria-label="Abrir menú" onClick={() => setMobileOpen(true)}><Menu /></IconButton><span className="brand-name">INKSTUDIO</span><IconButton aria-label="Notificaciones" onClick={() => open('notifications')}><Badge badgeContent={data.appointments.filter(item => item.status === 'Pendiente' && (isAdmin || item.artist === scope?.artist)).length} color="error"><NotificationsNone /></Badge></IconButton></div>
    <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 flex items-center gap-2"><span className="eyebrow-text amber-text">Operaciones CBBA</span><span className="live-dot" /><span className="mono-label text-slate-400">{cloud ? 'Conectado a Supabase' : 'Datos locales'}</span></div><h1 className="page-title">{titles[active]}</h1><p className="mt-2 text-sm text-slate-400">{prettyDate(today)} · {data.settings.address}</p></div><div className="flex items-center gap-2"><Tooltip title="Notificaciones"><IconButton aria-label="Ver notificaciones" onClick={() => open('notifications')}><Badge badgeContent={data.appointments.filter(item => item.status === 'Pendiente' && (isAdmin || item.artist === scope?.artist)).length} color="error"><NotificationsNone /></Badge></IconButton></Tooltip><Tooltip title="Descargar reporte CSV"><IconButton aria-label="Descargar reporte CSV" onClick={download} sx={{ color: '#ffc665', background: '#1d2026' }}><Download /></IconButton></Tooltip>{isAdmin && <Button variant="contained" startIcon={<AddCircle />} onClick={() => open(action)}>{action === 'client' ? 'Nuevo cliente' : action === 'payment' ? 'Registrar pago' : 'Registrar cita'}</Button>}</div></header>
    {cloud && <div className="mb-4 flex flex-wrap gap-2"><Button disabled={saving} onClick={refresh}>Actualizar datos</Button><Button disabled={saving} onClick={() => onSignOut().catch(() => setNotice('No se pudo cerrar la sesión. Inténtalo nuevamente.'))}>Cerrar sesión</Button></div>}
    {!cloud && active === 'dashboard' && <Alert severity="info" sx={{ mb: 2 }}>Datos guardados en este navegador. Las cuatro citas iniciales son ejemplos; los pagos comienzan vacíos.</Alert>}
    {isAdmin && ['dashboard', 'pagos'].includes(active) && <><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label, value, Icon]) => <Surface className="metric-card" key={label}><div className="flex items-center justify-between"><span className="eyebrow-text">{label}</span><Icon className="metric-icon amber" /></div><strong className="metric-value mt-4">{value}</strong></Surface>)}</div><div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3"><Surface className="xl:col-span-2">{chart}</Surface><Surface><div className="panel-heading"><div><span className="eyebrow-text">DISTRIBUCIÓN</span><h2>{active === 'dashboard' ? 'Estilos favoritos' : 'Canales de pago'}</h2></div><Analytics /></div>{(active === 'dashboard' ? styles : ['Efectivo', 'QR', 'Transferencia']).map(label => { const items = data.appointments.filter(item => item.status !== 'Cancelada'); const value = active === 'dashboard' ? items.filter(item => item.type === label).length : sum(data.payments.filter(item => item.method === label)); const total = active === 'dashboard' ? items.length : sum(data.payments); return <div className="mb-5" key={label}><div className="mb-2 flex justify-between text-xs"><span>{label}</span><span>{active === 'dashboard' ? `${total ? Math.round(value / total * 100) : 0}%` : money(value)}</span></div><div className="h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-amber-300" style={{ width: `${total ? value / total * 100 : 0}%` }} /></div></div> })}</Surface></div></>}
    {active === 'dashboard' && <Surface className="mt-4"><div className="panel-heading"><div><span className="eyebrow-text">AGENDA ACTIVA · {todayAppointments.length} TURNOS</span><h2>Citas del día</h2></div><Button endIcon={<ChevronRight />} onClick={() => { setDate(today); navigate('agenda') }}>Ver agenda</Button></div>{appointmentList(todayAppointments)}</Surface>}
    {active === 'agenda' && <><Surface className="mb-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><span className="eyebrow-text">{prettyDate(date)}</span><h2>Agenda del estudio</h2></div><div className="flex flex-wrap gap-2"><Button variant="outlined" onClick={() => shiftDay(-1)}>‹ Anterior</Button><Button variant="outlined" onClick={() => setDate(today)}>Hoy</Button><Button variant="outlined" onClick={() => shiftDay(1)}>Siguiente ›</Button><TextField label="Fecha" type="date" value={date} slotProps={{ inputLabel: { shrink: true } }} onChange={event => { if (event.target.value) setDate(event.target.value) }} /></div></div></Surface><Surface className="mb-4"><div className="panel-heading"><div><span className="eyebrow-text">PRÓXIMAS · {upcomingAppointments.length}</span><h2>Próximas citas</h2></div></div>{!upcomingAppointments.length && <p className="empty-slot">No hay citas futuras registradas.</p>}<div className="appointment-list">{upcomingAppointments.map(item => <button className="appointment-row interactive-row" key={item.id} onClick={() => open('appointment', item)}><span className="appointment-time">{item.time}</span><div className="appointment-client"><Avatar sx={{ bgcolor: '#32353c', color: '#ffc665' }}>{clientName(item.clientId)[0]}</Avatar><div><strong>{clientName(item.clientId)}</strong><span>{prettyDate(item.date)} · {item.artist} · {item.type}</span></div></div><StatusChip label={item.status} /></button>)}</div></Surface>{!agendaArtists.length && <Alert severity="warning">No hay tatuadores activos. Agrégalos desde «Equipo y permisos».</Alert>}<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">{agendaArtists.map((artist, index) => <Surface key={artist}><div className="mb-5 flex items-center gap-3"><Avatar>{artist[0]}</Avatar><div><h2>{artist}</h2><span className="mono-label text-slate-500">ESTACIÓN 0{index + 1}</span></div></div><div className="space-y-3">{appointmentsOn(date).filter(item => item.artist === artist).map(item => <button className="schedule-card interactive-row" key={item.id} onClick={() => open('appointment', item)}><span className="mono-label">{item.time}</span><strong>{clientName(item.clientId)}</strong><span>{item.type}</span><StatusChip label={item.status} /></button>)}{isAdmin && activeArtists.includes(artist) && <Button fullWidth variant="outlined" startIcon={<AddCircle />} onClick={() => open('appointment', { clientId: data.clients[0]?.id || '', date, time: '10:00', artist, type: styles[0], status: 'Pendiente', notes: '' })}>Añadir bloque</Button>}</div></Surface>)}</div></>}
    {active === 'clientes' && <><Surface className="mb-4"><TextField fullWidth label="Buscar por nombre, teléfono, email o CI" value={query} onChange={event => setQuery(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }} /><div className="mt-4 flex flex-wrap gap-2">{['Todos', 'Clientes frecuentes', 'Citas pendientes'].map(label => <Chip key={label} label={label === 'Todos' ? `Todos (${data.clients.length})` : label} variant={filter === label ? 'filled' : 'outlined'} color={filter === label ? 'primary' : 'default'} onClick={() => setFilter(label)} />)}</div></Surface><Surface><div className="panel-heading"><div><span className="eyebrow-text">DIRECTORIO · {visibleClients.length} RESULTADOS</span><h2>Base de datos de clientes</h2></div></div>{!visibleClients.length && <p className="empty-slot">No hay clientes que coincidan con la búsqueda.</p>}{visibleClients.map(client => <button className="client-row interactive-row" key={client.id} onClick={() => open('client', client)}><Avatar>{client.name[0]}</Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{client.name}</strong><StatusChip label={client.tag} /></div><span className="text-xs text-slate-400">{client.artist} · {client.phone || 'Sin teléfono'}</span></div><div className="text-right"><strong className="mono-value amber-text">{money(sum(data.payments.filter(item => item.clientId === client.id)))}</strong><span className="block text-xs text-slate-500">{data.appointments.filter(item => item.clientId === client.id && item.status === 'Completada').length} sesiones completadas</span></div></button>)}</Surface></>}
    {active === 'pagos' && <Surface className="mt-4"><div className="panel-heading"><div><span className="eyebrow-text">MOVIMIENTOS · {data.payments.length}</span><h2>Historial de pagos</h2></div></div>{!data.payments.length && <p className="empty-slot">Aún no hay pagos. Usa «Registrar pago» para añadir el primero.</p>}{[...data.payments].sort((a, b) => b.date.localeCompare(a.date)).map(payment => { const related = data.appointments.find(item => item.id === payment.appointmentId); return <button className="client-row interactive-row" key={payment.id} onClick={() => open('payment', payment)}><PaymentsIcon /><div className="flex-1"><strong>{clientName(payment.clientId)}</strong><span className="text-xs text-slate-400">{payment.date} · {payment.method} · {payment.concept}{related ? ` · Cita ${related.date}` : ' · Pago general'}</span></div><strong className="mono-value amber-text">{money(payment.amount)}</strong></button> })}</Surface>}
    <p className="text-xs text-slate-500 mt-6">Selecciona una cita, cliente o pago para ver y editar sus datos.</p>
  </main>
  <Dialog open={Boolean(dialog)} onClose={close} fullWidth maxWidth="sm"><DialogTitle>{dialog === 'notifications' ? 'Notificaciones del estudio' : dialog === 'appointment-details' ? 'Detalle de la cita' : dialog === 'settings' ? 'Configuración del estudio' : `${form.id ? 'Editar' : 'Registrar'} ${dialog === 'client' ? 'cliente' : dialog === 'payment' ? 'pago' : 'cita'}`}</DialogTitle>{dialog === 'notifications' ? <><DialogContent><AppointmentNotifications appointments={data.appointments} clients={data.clients} scope={scope} saving={saving} error={error} onRefresh={cloud ? refresh : undefined} onConfirm={async item => { const next = { ...data, appointments: data.appointments.map(row => row.id === item.id ? { ...row, status: 'Confirmada' } : row) }; if (await saveData(next)) setNotice('Cita confirmada'); }} /></DialogContent><DialogActions><Button onClick={close}>Cerrar</Button></DialogActions></> : dialog === 'appointment-details' ? <><DialogContent><div className="form-fields">{error && <Alert severity="error">{error}</Alert>}<div className="surface"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="eyebrow-text">CLIENTE</span><h2>{clientName(form.clientId)}</h2></div><StatusChip label={form.status} /></div><p className="mt-4"><strong>Fecha:</strong> {prettyDate(form.date)}</p><p><strong>Hora:</strong> {form.time}</p><p><strong>Tatuador:</strong> {form.artist}</p><p><strong>Estilo:</strong> {form.type}</p></div><Alert severity={appointmentBalance(form) > 0 ? 'warning' : 'success'}>Precio: {money(form.total_price || 0)} · Pagado: {money(appointmentPaid(form.id))} · Saldo: {money(appointmentBalance(form))}</Alert>{isAdmin || form.artist === scope?.artist ? <TextField fullWidth label="Notas de la cita" value={form.notes || ''} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} multiline minRows={3} helperText="Puedes añadir o actualizar la nota sin editar los demás datos." /> : <div className="surface"><span className="eyebrow-text">NOTAS</span><p className="mt-2">{form.notes || 'Sin notas registradas.'}</p></div>}</div></DialogContent><DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}><Button onClick={close}>Cerrar</Button>{isAdmin && <Button onClick={() => open('payment', { clientId: form.clientId, appointmentId: form.id, amount: '', method: 'QR', date: today, concept: 'Anticipo' })}>Registrar anticipo o pago</Button>}{(isAdmin || form.artist === scope?.artist) && <Button disabled={saving || (form.notes || '').trim() === (data.appointments.find(item => item.id === form.id)?.notes || '')} onClick={saveAppointmentNote}>Guardar nota</Button>}{(isAdmin || form.artist === scope?.artist) && <Button variant="contained" onClick={() => { setError(''); setDialog('appointment') }}>Editar cita</Button>}</DialogActions></> : <form onSubmit={submit}><fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0 }}><DialogContent><div className="form-fields">{error && <Alert severity="error">{error}</Alert>}
    {dialog === 'client' && <fieldset disabled={!isAdmin} className="form-fields" style={{ border: 0, padding: 0 }}><Field label="Nombre completo" name="name" value={form.name} onChange={change} required inputProps={{ maxLength: 120 }} /><Field label="Teléfono" name="phone" type="tel" value={form.phone} onChange={change} /><Field label="Correo electrónico" name="email" type="email" value={form.email} onChange={change} /><Field label="CI" name="ci" value={form.ci} onChange={change} /><Field label="Categoría" name="tag" value={form.tag} onChange={change} options={['Nueva', 'Activo', 'VIP']} /><Field label="Artista preferido" name="artist" value={form.artist} onChange={change} options={activeArtists.includes(form.artist) ? activeArtists : [form.artist, ...activeArtists].filter(Boolean)} /></fieldset>}
    {dialog === 'appointment' && <>{!activeArtists.length && !form.id && <Alert severity="warning">Primero agrega o activa un tatuador desde «Equipo y permisos».</Alert>}{!form.id && isAdmin && <div className="flex flex-wrap gap-2"><Button variant={!useNewClient ? 'contained' : 'outlined'} onClick={() => setUseNewClient(false)} disabled={!data.clients.length}>Cliente registrado</Button><Button variant={useNewClient ? 'contained' : 'outlined'} onClick={() => setUseNewClient(true)}>Cliente nuevo</Button></div>}{useNewClient && !form.id ? <><Alert severity="info">El cliente y la cita se guardarán juntos en Supabase. Si ocurre un error, no se registrará ninguno de los dos.</Alert><Field label="Nombre completo del cliente" name="name" value={newClient.name} onChange={changeNewClient} required inputProps={{ maxLength: 120 }} /><Field label="Teléfono" name="phone" type="tel" value={newClient.phone} onChange={changeNewClient} /><Field label="Correo electrónico" name="email" type="email" value={newClient.email} onChange={changeNewClient} /><Field label="CI" name="ci" value={newClient.ci} onChange={changeNewClient} /><Field label="Categoría" name="tag" value={newClient.tag} onChange={changeNewClient} options={['Nueva', 'Activo', 'VIP']} /><Field label="Artista preferido" name="artist" value={newClient.artist} onChange={changeNewClient} options={activeArtists} /></> : <><Alert severity="info">Selecciona un cliente que ya esté registrado. Si no aparece, usa la opción «Cliente nuevo».</Alert><Field disabled={!isAdmin} label="Cliente registrado" name="clientId" value={form.clientId} onChange={change} options={data.clients.map(client => ({ value: client.id, label: client.name }))} required /></>}<Field disabled={!isAdmin} label="Fecha" name="date" type="date" value={form.date} onChange={change} required /></>}
    {dialog === 'payment' && <>{!data.clients.length && <Alert severity="warning">No hay clientes registrados. Registra un cliente antes de añadir un pago.</Alert>}<Field label="Cliente" name="clientId" value={form.clientId} onChange={change} options={data.clients.map(client => ({ value: client.id, label: client.name }))} required /><Field label="Fecha" name="date" type="date" value={form.date} onChange={change} required /></>}
    {dialog === 'appointment' && <><Field disabled={!isAdmin} label="Hora" name="time" type="time" value={form.time} onChange={change} required /><Field disabled={!isAdmin} label="Artista" name="artist" value={form.artist} onChange={change} options={activeArtists.includes(form.artist) ? activeArtists : [form.artist, ...activeArtists].filter(Boolean)} /><Field disabled={!isAdmin} label="Estilo" name="type" value={form.type} onChange={change} options={styles} /><Field disabled={!isAdmin} label="Precio total (Bs.)" name="total_price" type="number" value={form.total_price} onChange={change} slotProps={{ htmlInput: { min: '0', step: '0.01' } }} /><Field disabled={!isAdmin && form.artist !== scope.artist} label="Estado" name="status" value={form.status} onChange={change} options={statuses} /><Field disabled={!isAdmin && form.artist !== scope.artist} label="Notas" name="notes" value={form.notes} onChange={change} multiline minRows={2} />{form.id && <Alert severity={appointmentBalance(form) > 0 ? 'warning' : 'success'}>Precio: {money(form.total_price || 0)} · Pagado: {money(appointmentPaid(form.id))} · Saldo: {money(appointmentBalance(form))}{isAdmin && <Button onClick={() => open('payment', { clientId: form.clientId, appointmentId: form.id, amount: '', method: 'QR', date: today, concept: 'Anticipo' })}>Registrar anticipo o pago</Button>}</Alert>}</>}
    {dialog === 'payment' && <><Field label="Cita relacionada (opcional)" name="appointmentId" value={form.appointmentId} onChange={change} options={[{ value: '', label: 'Pago general del cliente' }, ...data.appointments.filter(item => item.clientId === form.clientId).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).map(item => ({ value: item.id, label: `${item.date} · ${item.time} · ${item.artist}` }))]} /><Field label="Importe (Bs.)" name="amount" type="number" value={form.amount} onChange={change} required slotProps={{ htmlInput: { min: '0.01', step: '0.01' } }} /><Field label="Método de pago" name="method" value={form.method} onChange={change} options={['Efectivo', 'QR', 'Transferencia']} /><Field label="Concepto" name="concept" value={form.concept} onChange={change} required /><Alert severity="info">Vincula anticipos y abonos a una cita para calcular automáticamente su saldo. Este registro no realiza cobros ni transferencias bancarias.</Alert></>}
    {dialog === 'settings' && <><Field label="Nombre del administrador" name="name" value={form.name} onChange={change} required /><Field label="Nombre del estudio" name="studio" value={form.studio} onChange={change} required /><Field label="Dirección" name="address" value={form.address} onChange={change} required /></>}
    {confirmDelete && <Alert severity="warning">¿Eliminar este registro de forma definitiva?<div><Button color="error" onClick={remove}>Confirmar eliminación</Button><Button onClick={() => setConfirmDelete(false)}>Conservar</Button></div></Alert>}
  </div></DialogContent><DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>{isAdmin && form.id && <Button color="error" onClick={() => setConfirmDelete(true)}>Eliminar</Button>}<Button onClick={close}>Cancelar</Button>{(isAdmin || (dialog === 'appointment' && form.artist === scope.artist)) && <Button variant="contained" type="submit" disabled={(dialog === 'payment' && !data.clients.length) || (dialog === 'appointment' && !form.id && (!activeArtists.length || (!useNewClient && !data.clients.length)))}>{saving ? 'Guardando…' : useNewClient && dialog === 'appointment' && !form.id ? 'Guardar cliente y cita' : 'Guardar'}</Button>}</DialogActions></fieldset></form>}</Dialog>
  <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice('')} message={notice} action={<Button onClick={() => setNotice('')}>Cerrar</Button>} />
  </div>
}
export default App
