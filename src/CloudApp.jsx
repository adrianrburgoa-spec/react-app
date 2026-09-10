import { useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, TextField } from '@mui/material'
import App from './App.jsx'
import StudioAccess from './StudioAccess.jsx'
import { databaseError, fetchStudio, persistStudioChange, supabase } from './supabase.js'

function AccessForm({ recovery = false, onRecovered }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
      const result = recovery ? await supabase.auth.updateUser({ password })
        : mode === 'reset' ? await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      if (recovery) onRecovered()
      else if (mode === 'reset') setMessage('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.')
    } catch (cause) {
      setError(cause.code === 'invalid_credentials' ? 'Correo o contraseña incorrectos.' : cause.code === 'email_not_confirmed' ? 'Confirma tu correo antes de iniciar sesión.' : cause.code === 'over_email_send_rate_limit' ? 'Se alcanzó el límite de correos. Espera unos minutos antes de reintentar.' : 'No se pudo completar la solicitud. Revisa los datos y tu conexión e inténtalo nuevamente.')
    } finally { setBusy(false) }
  }
  return <main className="access-page"><section className="surface access-card"><div className="brand-mark">IS</div><h1 className="page-title mt-5">InkStudio</h1><p className="mt-3 mb-6 text-slate-400">{recovery ? 'Elige una nueva contraseña.' : mode === 'reset' ? 'Recupera el acceso a tu cuenta.' : 'Inicia sesión con una cuenta proporcionada por el administrador.'}</p><form className="form-fields" onSubmit={submit}>{error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}{!recovery && <TextField label="Correo electrónico" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />}{(recovery || mode !== 'reset') && <TextField label={recovery ? 'Nueva contraseña' : 'Contraseña'} type="password" autoComplete={recovery ? 'new-password' : 'current-password'} required value={password} onChange={event => setPassword(event.target.value)} slotProps={{ htmlInput: { minLength: recovery ? 8 : 1 } }} helperText={recovery ? 'Usa al menos 8 caracteres.' : ''} />}<Button type="submit" variant="contained" disabled={busy}>{busy ? 'Procesando…' : recovery ? 'Guardar contraseña' : mode === 'reset' ? 'Enviar enlace' : 'Iniciar sesión'}</Button>{!recovery && <Button disabled={busy} onClick={() => { setMode(mode === 'reset' ? 'login' : 'reset'); setMessage(''); setError('') }}>{mode === 'reset' ? 'Volver al inicio de sesión' : 'Olvidé mi contraseña'}</Button>}</form></section></main>
}

function WorkspaceData({ session, scope, studios, onSelect, onReload }) {
  const [initial, setInitial] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    fetchStudio(scope.owner_id).then(data => { if (current) setInitial(data) }).catch(cause => { if (current) setError(databaseError(cause)) })
    return () => { current = false }
  }, [scope.owner_id, attempt])
  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
  }
  if (!initial) return <main className="access-page"><section className="surface access-card">{error ? <><Alert severity="error">{error}</Alert><Button onClick={() => { setError(''); setAttempt(value => value + 1) }}>Reintentar</Button><Button onClick={() => signOut().catch(() => setError('No se pudo cerrar la sesión. Vuelve a intentarlo.'))}>Cerrar sesión</Button></> : <><CircularProgress /><p className="mt-4">Cargando datos del estudio…</p></>}</section></main>
  return <App initial={initial} cloud scope={scope} toolbar={<StudioAccess session={session} scope={scope} studios={studios} onSelect={onSelect} onReload={onReload} />} onPersist={(previous, next) => persistStudioChange(previous, next, scope.owner_id)} onRefresh={() => fetchStudio(scope.owner_id)} onSignOut={signOut} />
}

function Workspace({ session }) {
  const [studios, setStudios] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const select = id => { setSelected(id); try { localStorage.setItem(`inkstudio-scope-${session.user.id}`, id) } catch { /* Selection still works in memory. */ } }
  const reload = async preferred => {
    const result = await supabase.rpc('list_studios')
    if (result.error) throw Error('No se pudieron cargar los estudios.')
    setStudios(result.data)
    if (preferred) select(preferred)
  }
  useEffect(() => {
    let current = true
    supabase.rpc('list_studios').then(result => {
      if (!current) return
      if (result.error) { setError('No se pudieron cargar tus permisos. Recarga la página.'); return }
      let saved
      try { saved = localStorage.getItem(`inkstudio-scope-${session.user.id}`) } catch { /* Use default studio. */ }
      setStudios(result.data)
      setSelected(result.data.find(studio => studio.owner_id === saved)?.owner_id || result.data.find(studio => studio.owner_id !== session.user.id)?.owner_id || session.user.id)
    })
    return () => { current = false }
  }, [session.user.id])
  const scope = studios.find(studio => studio.owner_id === selected)
  if (error) return <main className="access-page"><Alert severity="error">{error}</Alert></main>
  if (!scope) return <main className="access-page"><CircularProgress /></main>
  return <WorkspaceData key={scope.owner_id} session={session} scope={scope} studios={studios} onSelect={select} onReload={reload} />
}

export default function CloudApp() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [authError, setAuthError] = useState('')
  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession); setReady(true)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
    })
    let current = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!current) return
      if (error) setAuthError('No se pudo recuperar la sesión. Recarga la página para reintentar.')
      else setSession(data.session)
      setReady(true)
    }).catch(() => { if (current) { setAuthError('No se pudo conectar al servicio de acceso. Recarga la página.'); setReady(true) } })
    return () => { current = false; subscription.unsubscribe() }
  }, [])
  if (!supabase) return import.meta.env.DEV ? <App /> : <main className="access-page"><Alert severity="error">Falta configurar la conexión del estudio. Contacta al administrador.</Alert></main>
  if (!ready) return <main className="access-page"><CircularProgress aria-label="Conectando" /></main>
  if (authError) return <main className="access-page"><Alert severity="error">{authError}</Alert></main>
  if (recovery) return <AccessForm recovery onRecovered={() => setRecovery(false)} />
  return session ? <Workspace key={session.user.id} session={session} /> : <AccessForm />
}
