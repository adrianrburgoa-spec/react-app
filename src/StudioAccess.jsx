import { useEffect, useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material'
import { supabase } from './supabase.js'

export default function StudioAccess({ session, scope, studios, onSelect, onArtistsChanged }) {
  const [tab, setTab] = useState(null)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [artists, setArtists] = useState([])
  const [artistDrafts, setArtistDrafts] = useState({})
  const [artistName, setArtistName] = useState('')
  const [role, setRole] = useState('artist')
  const [artist, setArtist] = useState('')
  const [username, setUsername] = useState('')
  const [credentials, setCredentials] = useState(null)
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [removeMember, setRemoveMember] = useState(null)
  const activeArtists = artists.filter(item => item.active)
  const applyTeam = (people, codes, catalog) => {
    setMembers(people.data); setInvites(codes.data); setArtists(catalog.data)
    setArtistDrafts(Object.fromEntries(catalog.data.map(item => [item.id, item.name])))
    const firstActive = catalog.data.find(item => item.active)?.name || ''
    setArtist(current => catalog.data.some(item => item.active && item.name === current) ? current : firstActive)
  }
  const loadTeam = async () => {
    const [people, codes, catalog] = await Promise.all([
      supabase.rpc('list_studio_members', { studio_id: scope.owner_id }),
      supabase.from('studio_invites').select('id,role,artist,expires_at,consumed_at').eq('owner_id', scope.owner_id).is('consumed_at', null).gt('expires_at', new Date().toISOString()),
      supabase.from('artists').select('id,name,active').eq('owner_id', scope.owner_id).order('name'),
    ])
    if (people.error || codes.error || catalog.error) throw Error('No se pudo cargar el equipo.')
    applyTeam(people, codes, catalog)
  }
  useEffect(() => {
    if (tab !== 'team') return
    let current = true
    Promise.all([
      supabase.rpc('list_studio_members', { studio_id: scope.owner_id }),
      supabase.from('studio_invites').select('id,role,artist,expires_at,consumed_at').eq('owner_id', scope.owner_id).is('consumed_at', null).gt('expires_at', new Date().toISOString()),
      supabase.from('artists').select('id,name,active').eq('owner_id', scope.owner_id).order('name'),
    ]).then(([people, codes, catalog]) => {
      if (!current) return
      if (people.error || codes.error || catalog.error) setError('No se pudo cargar el equipo.')
      else applyTeam(people, codes, catalog)
    })
    return () => { current = false }
  }, [tab, scope.owner_id])
  const run = async task => {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try { await task() } catch (cause) { setError(cause.message || 'No se pudo completar la operación.') }
    finally { setBusy(false) }
  }
  const open = value => { setTab(value); setError(''); setMessage(''); setCredentials(null); setPassword(''); setNewPassword(''); setConfirmation(''); setRemoveMember(null) }
  const close = () => { if (!busy) { setTab(null); setPassword(''); setNewPassword(''); setConfirmation(''); setCredentials(null) } }
  const changeAccount = async event => {
    event.preventDefault()
    await run(async () => {
      if (newPassword && newPassword !== confirmation) throw Error('Las contraseñas nuevas no coinciden.')
      if (!newPassword) throw Error('Escribe una nueva contraseña.')
      const login = await supabase.auth.signInWithPassword({ email: session.user.email, password })
      if (login.error) throw Error('La contraseña actual no es correcta.')
      const result = await supabase.auth.updateUser({ password: newPassword })
      if (result.error) throw Error('No se pudo cambiar la contraseña. Vuelve a intentarlo.')
      setPassword(''); setNewPassword(''); setConfirmation('')
      setMessage('Contraseña actualizada. Usa la nueva contraseña en tu próximo acceso.')
    })
  }
  return <><div className="surface mb-4 flex flex-wrap items-center gap-3">
    <TextField select label="Estudio activo" value={scope.owner_id} onChange={event => onSelect(event.target.value)} sx={{ minWidth: 210 }}>{studios.map(studio => <MenuItem key={studio.owner_id} value={studio.owner_id}>{studio.studio}</MenuItem>)}</TextField>
    <span className="text-sm text-slate-400">{scope.role === 'admin' ? 'Administrador' : `Tatuador · ${scope.artist}`}</span>
    {scope.role === 'admin' && <Button onClick={() => open('team')}>Equipo y permisos</Button>}
    <Button onClick={() => open('account')}>Mi cuenta</Button>
  </div><Dialog open={Boolean(tab)} onClose={close} fullWidth maxWidth="sm"><DialogTitle>{tab === 'team' ? 'Equipo y permisos' : 'Acceso y recuperación'}</DialogTitle><DialogContent><div className="form-fields">
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    {tab === 'account' && <><p className="text-sm">Acceso actual: {session.user.email}</p>{/\.(example|invalid|test)$/i.test(session.user.email) && <Alert severity="info">Puedes seguir usando tu cuenta actual. La recuperación por correo estará disponible cuando agregues y confirmes un correo real.</Alert>}<form className="form-fields" onSubmit={changeAccount}><TextField label="Contraseña actual" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /><TextField label="Nueva contraseña" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} slotProps={{ htmlInput: { minLength: 8 } }} /><TextField label="Repetir nueva contraseña" type="password" autoComplete="new-password" required={Boolean(newPassword)} value={confirmation} onChange={event => setConfirmation(event.target.value)} /><Button type="submit" variant="contained" disabled={busy}>Actualizar acceso</Button></form></>}
    {tab === 'team' && <><Alert severity="info">Los administradores gestionan clientes, agenda, caja y equipo. Los tatuadores consultan clientes y agenda, y solo cambian el estado y notas de sus propias citas. No tienen acceso a caja.</Alert>
      <h3>Catálogo de tatuadores</h3>
      <p className="text-sm text-slate-400">Los tatuadores activos aparecen al registrar clientes, citas y cuentas. Desactivar conserva todo su historial.</p>
      {artists.map(item => <div className="surface flex flex-wrap items-center gap-2" key={item.id}><TextField label="Nombre del tatuador" value={artistDrafts[item.id] ?? item.name} onChange={event => setArtistDrafts(previous => ({ ...previous, [item.id]: event.target.value }))} size="small" sx={{ flex: 1, minWidth: 190 }} /><Button disabled={busy || !artistDrafts[item.id]?.trim() || artistDrafts[item.id]?.trim() === item.name} onClick={() => run(async () => { const result = await supabase.from('artists').update({ name: artistDrafts[item.id].trim() }).eq('id', item.id).eq('owner_id', scope.owner_id).select().single(); if (result.error) throw Error(result.error.code === '23505' ? 'Ya existe un tatuador con ese nombre.' : 'No se pudo cambiar el nombre.'); await loadTeam(); await onArtistsChanged?.(); setMessage('Nombre actualizado en clientes, citas y cuentas relacionadas.') })}>Guardar nombre</Button><Button disabled={busy || (item.active && activeArtists.length === 1)} color={item.active ? 'warning' : 'success'} onClick={() => run(async () => { const result = await supabase.from('artists').update({ active: !item.active }).eq('id', item.id).eq('owner_id', scope.owner_id); if (result.error) throw Error('No se pudo cambiar el estado del tatuador.'); await loadTeam(); await onArtistsChanged?.(); setMessage(item.active ? 'Tatuador desactivado; su historial se conserva.' : 'Tatuador activado.') })}>{item.active ? 'Desactivar' : 'Activar'}</Button></div>)}
      <div className="flex flex-wrap gap-2"><TextField label="Nombre del nuevo tatuador" value={artistName} onChange={event => setArtistName(event.target.value)} size="small" sx={{ flex: 1, minWidth: 210 }} /><Button variant="contained" disabled={busy || !artistName.trim()} onClick={() => run(async () => { const result = await supabase.from('artists').insert({ owner_id: scope.owner_id, name: artistName.trim(), active: true }); if (result.error) throw Error(result.error.code === '23505' ? 'Ya existe un tatuador con ese nombre.' : 'No se pudo agregar el tatuador.'); setArtistName(''); await loadTeam(); await onArtistsChanged?.(); setMessage('Tatuador agregado y disponible para nuevas asignaciones.') })}>Agregar tatuador</Button></div>
      <h3>Cuentas y permisos</h3>
      {members.map(member => <div className="surface" key={member.user_id}><p className="text-sm">{member.email}</p><p className="text-xs text-slate-400">{member.is_owner ? 'Propietario' : member.role === 'admin' ? 'Administrador' : `Tatuador · ${member.artist}`}</p>{!member.is_owner && <Button color="error" disabled={busy} onClick={() => setRemoveMember(member)}>Quitar acceso</Button>}</div>)}
      {removeMember && <Alert severity="warning">¿Quitar el acceso de {removeMember.email}? Sus datos de trabajo permanecerán en el estudio.<Button disabled={busy} color="error" onClick={() => run(async () => { const result = await supabase.from('studio_members').delete().eq('owner_id', scope.owner_id).eq('user_id', removeMember.user_id); if (result.error) throw Error('No se pudo quitar el acceso.'); setRemoveMember(null); await loadTeam(); setMessage('Acceso retirado.') })}>Confirmar</Button><Button onClick={() => setRemoveMember(null)}>Cancelar</Button></Alert>}
      <TextField select label="Rol del nuevo integrante" value={role} onChange={event => setRole(event.target.value)}><MenuItem value="artist">Tatuador</MenuItem><MenuItem value="admin">Administrador</MenuItem></TextField>
      {role === 'artist' && <TextField select label="Tatuador asignado" value={artist} onChange={event => setArtist(event.target.value)}>{activeArtists.map(item => <MenuItem value={item.name} key={item.id}>{item.name}</MenuItem>)}</TextField>}
      <TextField label="Nombre de usuario para la nueva cuenta" helperText="Letras, números o guiones. No necesita un correo real." value={username} onChange={event => setUsername(event.target.value)} />
      <Button disabled={busy || !/^[a-z0-9-]{3,30}$/.test(username) || (role === 'artist' && !artist)} variant="contained" onClick={() => run(async () => {
        const result = await supabase.functions.invoke('studio-staff', { body: { ownerId: scope.owner_id, username, role, artist: role === 'artist' ? artist : null } })
        if (result.error || result.data?.error) throw Error(result.data?.error || 'No se pudo crear la cuenta. Revisa el nombre de usuario y tus permisos.')
        setCredentials(result.data); await loadTeam()
      })}>Crear cuenta del personal</Button>
      <Button disabled={busy || (role === 'artist' && !artist)} onClick={() => run(async () => { const result = await supabase.rpc('create_studio_invite', { studio_id: scope.owner_id, member_role: role, member_artist: role === 'artist' ? artist : null }); if (result.error) throw Error('No se pudo crear la invitación.'); setCredentials({ code: result.data }); await loadTeam() })}>Generar código para una cuenta existente</Button>
      {credentials && <Alert severity="success"><p>Comparte estos datos únicamente con el integrante. Se muestran hasta cerrar esta ventana.</p>{credentials.code ? <TextField fullWidth label="Código (vence en 7 días, un solo uso)" value={credentials.code} slotProps={{ input: { readOnly: true } }} sx={{ mt: 2 }} /> : <><p>Correo: {credentials.email}</p><p>Contraseña inicial: {credentials.password}</p><p>Puede cambiarla en «Mi cuenta».</p></>}</Alert>}
      {invites.map(invite => <div key={invite.id} className="flex items-center justify-between gap-2"><span className="text-sm">Invitación {invite.role === 'admin' ? 'administrador' : invite.artist} · vence {new Date(invite.expires_at).toLocaleDateString('es-BO')}</span><Button disabled={busy} onClick={() => run(async () => { const result = await supabase.from('studio_invites').delete().eq('id', invite.id); if (result.error) throw Error('No se pudo revocar la invitación.'); await loadTeam() })}>Revocar</Button></div>)}
    </>}
  </div></DialogContent><DialogActions><Button disabled={busy} onClick={close}>Cerrar</Button></DialogActions></Dialog></>
}
