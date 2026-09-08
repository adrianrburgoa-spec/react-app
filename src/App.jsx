import { useState } from 'react'
import {
  AddCircle, Analytics, CalendarMonth, ChevronRight, Close,
  Dashboard as DashboardIcon, Download, EventAvailable, Groups, Menu, NotificationsNone,
  Payments as PaymentsIcon, Search, Settings, TrendingUp, Verified, Wallet,
} from '@mui/icons-material'
import {
  Avatar, Button, Chip, Drawer, IconButton, InputAdornment, LinearProgress,
  List, ListItemButton, ListItemIcon, ListItemText, TextField, Tooltip,
} from '@mui/material'
import './App.css'

const navItems = [
  { id: 'dashboard', label: 'Panel principal', icon: DashboardIcon },
  { id: 'agenda', label: 'Agenda y citas', icon: CalendarMonth },
  { id: 'clientes', label: 'Clientes CRM', icon: Groups },
  { id: 'pagos', label: 'Pagos y caja', icon: PaymentsIcon },
]

const appointments = [
  { time: '10:00', client: 'Camila Andrea Torrico', artist: 'Diego Arnez', type: 'Blackwork custom', status: 'En proceso', color: 'amber' },
  { time: '12:30', client: 'Rodrigo Villarroel Arce', artist: 'Lucas Méndez', type: 'Fine line / minimal', status: 'Confirmada', color: 'green' },
  { time: '15:00', client: 'Mariana Ferrufino', artist: 'Sofía Rojas', type: 'Realismo & sombras', status: 'Pendiente', color: 'cyan' },
  { time: '17:30', client: 'Sebastián Quiroga', artist: 'Diego Arnez', type: 'Cover-up / restauro', status: 'Confirmada', color: 'green' },
]

const kpis = [
  { label: 'Citas de hoy', value: '8', detail: '+2 vs ayer', icon: EventAvailable, tone: 'amber' },
  { label: 'Esta semana', value: '34', detail: 'sesiones', icon: CalendarMonth, tone: 'cyan' },
  { label: 'Clientes CRM', value: '612', detail: '+18 este mes', icon: Groups, tone: 'amber' },
  { label: 'Ingresos mes', value: 'Bs. 48.650', detail: '+14,2% meta mensual', icon: PaymentsIcon, tone: 'amber' },
  { label: 'Señas pendientes', value: '5', detail: 'Bs. 850 por cobrar', icon: Wallet, tone: 'cyan' },
  { label: 'Completadas', value: '128', detail: '98,5% satisfacción', icon: Verified, tone: 'green' },
]

function StatusChip({ label, color = 'amber' }) {
  const colors = { amber: '#ffc665', green: '#54ea7e', cyan: '#4cd7f6', red: '#ff7186' }
  return <Chip label={label} size="small" sx={{ color: colors[color], backgroundColor: `${colors[color]}18`, border: `1px solid ${colors[color]}35`, fontWeight: 700 }} />
}

function Surface({ children, className = '' }) {
  return <section className={`surface ${className}`}>{children}</section>
}

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <Surface className="metric-card group">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow-text">{label}</span>
        <Icon className={`metric-icon ${tone}`} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <strong className="metric-value">{value}</strong>
        <span className={`metric-detail ${tone}`}>{detail}</span>
      </div>
    </Surface>
  )
}

function Header({ title, eyebrow, onMenu, actionLabel = 'Registrar cita', onAction }) {
  return (
    <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="eyebrow-text amber-text">{eyebrow}</span>
          <span className="live-dot" />
          <span className="mono-label text-slate-400">Estudio en vivo</span>
        </div>
        <h1 className="page-title">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">Lunes, 28 de octubre, 2024 · Sede América Oeste #842, Cochabamba</p>
      </div>
      <div className="flex items-center gap-2">
        <IconButton className="mobile-menu" onClick={onMenu} sx={{ color: '#e1e2eb' }}><Menu /></IconButton>
        <Tooltip title="Descargar reporte"><IconButton sx={{ color: '#ffc665', background: '#1d2026' }}><Download /></IconButton></Tooltip>
        <Button variant="contained" startIcon={<AddCircle />} onClick={onAction}>{actionLabel}</Button>
      </div>
    </header>
  )
}

function Sidebar({ active, onNavigate, mobileOpen, onClose }) {
  return (
    <>
      <Drawer variant="permanent" className="desktop-drawer" open PaperProps={{ className: 'sidebar' }}>
        <SidebarContent active={active} onNavigate={onNavigate} />
      </Drawer>
      <Drawer variant="temporary" open={mobileOpen} onClose={onClose} PaperProps={{ className: 'sidebar' }}>
        <SidebarContent active={active} onNavigate={onNavigate} />
      </Drawer>
    </>
  )
}

function SidebarContent({ active, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="brand-block"><div className="brand-mark">IS</div><div><div className="brand-name">INKSTUDIO</div><div className="brand-meta">CBBA · OPERACIONES</div></div></div>
      <div className="px-4 pb-3 pt-8 mono-label text-slate-500">ESPACIO DE TRABAJO</div>
      <List className="px-2">
        {navItems.map(({ id, label, icon: Icon }) => <ListItemButton key={id} selected={active === id} onClick={() => onNavigate(id)} className="nav-item"><ListItemIcon><Icon /></ListItemIcon><ListItemText primary={label} /></ListItemButton>)}
      </List>
      <div className="mt-auto p-4">
        <div className="artist-card"><Avatar sx={{ bgcolor: '#e5a93c', color: '#432c00', width: 36, height: 36, fontWeight: 700 }}>AR</Avatar><div className="min-w-0"><div className="truncate text-sm font-semibold">Adrián R.</div><div className="mono-label text-slate-500">Administrador</div></div><Settings className="ml-auto text-slate-500" fontSize="small" /></div>
      </div>
    </div>
  )
}

function FinanceChart() {
  const bars = [52, 56, 50, 60, 67, 72, 78, 81, 85, 95]
  return <div className="chart-area">{bars.map((height, index) => <div className="chart-bar-wrap" key={index}><div className={`chart-bar ${index === bars.length - 1 ? 'active' : ''}`} style={{ height: `${height}%` }} /><span>{['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT'][index]}</span></div>)}</div>
}

function AppointmentsPanel() {
  return <Surface className="overflow-hidden p-0"><div className="panel-heading"><div><span className="eyebrow-text">AGENDA ACTIVA · 4 TURNOS</span><h2>Próximas citas del día</h2></div><Button variant="text" endIcon={<ChevronRight />} sx={{ color: '#ffc665' }}>Ver agenda</Button></div><div className="appointment-list">{appointments.map((item) => <div className="appointment-row" key={item.time}><span className="appointment-time">{item.time}</span><div className="appointment-client"><Avatar sx={{ width: 36, height: 36, bgcolor: '#32353c', color: '#ffc665' }}>{item.client[0]}</Avatar><div><strong>{item.client}</strong><span>{item.type} · {item.artist}</span></div></div><StatusChip label={item.status} color={item.color} /></div>)}</div></Surface>
}

function Dashboard({ onAction }) {
  return <><Header title="Panel principal — InkStudio CBBA" eyebrow="Operaciones CBBA" actionLabel="Registrar cita" onAction={onAction} /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{kpis.map((kpi) => <MetricCard key={kpi.label} {...kpi} />)}</div><div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-10"><Surface className="xl:col-span-7"><div className="panel-heading"><div><span className="eyebrow-text">MÉTRICAS FINANCIERAS · 2024 YTD</span><h2>Resumen financiero y tendencia</h2></div><Button size="small" sx={{ color: '#ffc665' }}>Meses⌄</Button></div><FinanceChart /></Surface><Surface className="xl:col-span-3"><div className="panel-heading"><div><span className="eyebrow-text">DISTRIBUCIÓN</span><h2>Estilos favoritos</h2></div><Analytics className="text-cyan-300" /></div><div className="space-y-5">{[['Blackwork custom', 42, 'bg-amber-300'], ['Fine line / minimal', 28, 'bg-cyan-300'], ['Realismo & sombras', 20, 'bg-green-300'], ['Cover-up / restauro', 10, 'bg-slate-400']].map(([label, value, color]) => <div key={label}><div className="mb-2 flex justify-between text-xs"><span>{label}</span><span className="mono-label text-slate-400">{value}%</span></div><div className="h-1.5 rounded-full bg-slate-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div></div>)}</div></Surface></div><div className="mt-4"><AppointmentsPanel /></div></>
}

function Clients() {
  const clients = [['Camila Andrea Torrico Paz', 'VIP', 'Bs. 3.200', '4 tatuajes', 'Diego Arnez'], ['Rodrigo Villarroel Arce', 'Activo', 'Bs. 2.100', '2 tatuajes', 'Lucas Méndez'], ['Mariana Ferrufino', 'Nueva', 'Bs. 840', '1 tatuaje', 'Sofía Rojas'], ['Sebastián Quiroga', 'Activo', 'Bs. 1.650', '3 tatuajes', 'Diego Arnez']]
  return <><Header title="Directorio de clientes" eyebrow="InkStudio CBBA · CRM Suite" actionLabel="Nuevo cliente" /><Surface className="mb-4"><TextField fullWidth placeholder="Buscar por nombre, teléfono, email o CI..." InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: '#9d8f7c' }} /></InputAdornment> }} /><div className="mt-4 flex flex-wrap gap-2"><StatusChip label="Todos (612)" /><Chip label="Clientes frecuentes" /><Chip label="Citas pendientes" variant="outlined" /></div></Surface><Surface className="overflow-hidden p-0"><div className="panel-heading"><div><span className="eyebrow-text">DIRECTORIO · 612 CLIENTES ACTIVOS</span><h2>Base de datos de clientes</h2></div><span className="mono-label text-slate-500">COCHABAMBA STUDIO DB</span></div><div className="divide-y divide-slate-800">{clients.map(([name, tag, total, count, artist]) => <div className="client-row" key={name}><Avatar sx={{ bgcolor: '#32353c', color: '#ffc665' }}>{name[0]}</Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{name}</strong><StatusChip label={tag} color={tag === 'VIP' ? 'amber' : tag === 'Nueva' ? 'green' : 'cyan'} /></div><span className="text-xs text-slate-400">Preferencia: {artist} · +591 70788912</span></div><div className="text-right"><strong className="mono-value amber-text">{total}</strong><span className="block text-xs text-slate-500">{count}</span></div></div>)}</div></Surface></>
}

function Payments() {
  return <><Header title="Registro de pagos y caja diaria" eyebrow="Módulo de tesorería" actionLabel="Registrar pago" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">{[['Ingresos de hoy', 'Bs. 3.450', 78, 'amber'], ['QR Simple Bolivia', 'Bs. 1.900', 55, 'cyan'], ['Cobros en efectivo', 'Bs. 1.550', 45, 'green'], ['Saldos por cobrar', 'Bs. 4.200', 62, 'red'], ['Comisiones a liquidar', 'Bs. 2.070', 50, 'amber']].map(([label, value, progress, tone]) => <Surface className="metric-card" key={label}><span className="eyebrow-text">{label}</span><strong className={`metric-value mt-4 ${tone}`}>{value}</strong><LinearProgress variant="determinate" value={progress} sx={{ mt: 2, backgroundColor: '#0b0e14', '& .MuiLinearProgress-bar': { backgroundColor: tone === 'cyan' ? '#4cd7f6' : tone === 'green' ? '#54ea7e' : tone === 'red' ? '#ff7186' : '#ffc665' } }} /></Surface>)}</div><div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3"><Surface className="lg:col-span-2"><div className="panel-heading"><div><span className="eyebrow-text">FLUJO DIARIO</span><h2>Curva de transacciones por turnos</h2></div><TrendingUp className="text-green-300" /></div><FinanceChart /></Surface><Surface><div className="panel-heading"><div><span className="eyebrow-text">CANALES ACTIVOS</span><h2>Cuentas habilitadas</h2></div></div>{['Banco Nacional de Bolivia', 'Banco de Crédito de Bolivia', 'Banco Unión S.A.'].map((bank) => <div className="bank-row" key={bank}><div className="bank-logo">BOB</div><div><strong>{bank}</strong><span>Cuenta ·•••• 9841</span></div><StatusChip label="QR activo" color="green" /></div>)}</Surface></div></>
}

function Agenda() { return <><Header title="Agenda y gestión de citas" eyebrow="Planificación de sesiones" actionLabel="Nueva cita" /><Surface className="mb-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><span className="eyebrow-text">LUNES · 28 OCTUBRE 2024</span><h2>Agenda del estudio</h2></div><div className="flex gap-2"><Button variant="outlined">‹ Anterior</Button><Button variant="outlined">Hoy</Button><Button variant="outlined">Siguiente ›</Button></div></div></Surface><div className="grid grid-cols-1 gap-4 xl:grid-cols-3">{['Diego Arnez', 'Lucas Méndez', 'Sofía Rojas'].map((artist) => <Surface key={artist}><div className="mb-5 flex items-center gap-3"><Avatar sx={{ bgcolor: '#32353c', color: '#ffc665' }}>{artist[0]}</Avatar><div><h2>{artist}</h2><span className="mono-label text-slate-500">ESTACIÓN {artist === 'Diego Arnez' ? '01' : artist === 'Lucas Méndez' ? '02' : '03'}</span></div></div><div className="space-y-3">{appointments.filter((item) => item.artist === artist).map((item) => <div className={`schedule-card ${item.color}`} key={item.time}><div className="mono-label">{item.time}</div><strong>{item.client}</strong><span>{item.type}</span><StatusChip label={item.status} color={item.color} /></div>)}<div className="empty-slot">+ Añadir bloque</div></div></Surface>)}</div></> }

function App() {
  const [active, setActive] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notice, setNotice] = useState(false)
  const navigate = (id) => { setActive(id); setMobileOpen(false) }
  const view = active === 'clientes' ? <Clients /> : active === 'pagos' ? <Payments /> : active === 'agenda' ? <Agenda /> : <Dashboard onAction={() => setNotice(true)} />
  return <div className="app-frame"><Sidebar active={active} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} /><main className="main-content"><div className="mobile-topbar"><IconButton onClick={() => setMobileOpen(true)}><Menu /></IconButton><span className="brand-name">INKSTUDIO</span><IconButton><NotificationsNone /></IconButton></div>{view}</main>{notice && <div className="toast"><Verified /> Cita lista para registrar <IconButton size="small" onClick={() => setNotice(false)}><Close fontSize="small" /></IconButton></div>}</div>
}

export default App
