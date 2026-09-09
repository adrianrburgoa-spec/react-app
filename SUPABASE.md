# Base de datos de InkStudio

Proyecto: `detjocruvtqtekjyquth` (`inkstudio-cbba`), región São Paulo.
Panel: https://supabase.com/dashboard/project/detjocruvtqtekjyquth

La primera migración crea clientes, citas, pagos y configuración. La migración
`20260910010000_team_and_reminders.sql` añade miembros, invitaciones y permisos
compartidos. `owner_id` identifica el estudio y los datos anteriores se conservan.
Las relaciones impiden asociar pagos o citas a clientes de otro estudio.

## Equipo y permisos

En **Equipo y permisos**, el administrador puede crear cuentas del personal
sin correos reales. El sistema muestra el correo ficticio y una contraseña
inicial una sola vez en esa ventana; el integrante puede cambiarla en **Mi cuenta**.
La función `studio-staff` valida la sesión y el rol administrador antes de crear
la cuenta y asignarla al estudio. Las claves administrativas permanecen en el servidor.

También se pueden generar códigos para personas que ya tienen una cuenta.
Estas los usan en **Unirme a un estudio**. Los códigos vencen en siete días,
solo se pueden aceptar una vez y pueden revocarse. Se almacenan únicamente sus
hashes en la base de datos. Al unirse, se conserva el estudio anterior y se puede
elegir el **Estudio activo**.

- Propietario: administrador permanente de su estudio.
- Administrador: gestiona clientes, citas, pagos, configuración e integrantes.
- Tatuador: consulta clientes y agenda del estudio; cambia únicamente el estado
  y las notas de las citas asignadas a su nombre. No lee pagos ni modifica clientes,
  asignaciones, horarios o permisos. Estas reglas también se aplican en la base.

**Quitar acceso** retira la pertenencia sin borrar el trabajo del integrante.
La sesión que ya estaba abierta pierde el permiso para realizar nuevas consultas
y escrituras; la información ya descargada puede seguir visible hasta actualizar.

## Notificaciones internas

La campana muestra las citas pendientes. El personal contacta al cliente por
su cuenta y pulsa **Confirmar cita** tras recibir la confirmación. El cambio se
guarda en Supabase y la cita sale de las notificaciones pendientes. Un tatuador
solo puede confirmar sus propias citas; los administradores pueden confirmar
cualquiera del estudio. **Actualizar notificaciones** consulta los datos actuales.
No se envían correos, WhatsApp ni notificaciones fuera de la página.

## Abrir la aplicación

Ejecuta `npm.cmd run dev` y abre http://127.0.0.1:5173/react-app/.
Inicia sesión con la cuenta ficticia `admin@inkstudio.example`. Su contraseña
está en el archivo local `.env.inkstudio-login`, excluido de Git. La cuenta ya
está confirmada y es independiente del correo de administración de Supabase.
El correo ficticio no recibe mensajes: la recuperación de esta cuenta debe
hacerse desde la administración de Supabase.
Por decisión del usuario, el correo real y su recuperación quedan para después.
**Mi cuenta** permite cambiar la contraseña introduciendo la actual y repitiendo
la nueva. No se modificaron las reglas de confirmación de correo de Supabase.
Los estudios nuevos comienzan vacíos. Los datos de demostración locales siguen
en el navegador; no se importan automáticamente a la base de datos.

Los registros se guardan en Supabase. **Actualizar datos** trae los cambios de
otra sesión. Si dos sesiones editan el mismo registro, el control de versión
rechaza la segunda edición para evitar sobrescribir cambios sin avisar.

## Credenciales locales

- `.env.local`: URL y clave pública para Vite.
- `.env.supabase-admin`: contraseña de PostgreSQL, solo para administración.
- `.env.inkstudio-login`: correo y contraseña de acceso a la aplicación.
- El token de la CLI lo administra `supabase login` fuera del repositorio.

Los archivos `.env*` reales están excluidos de Git. No copies la contraseña de
PostgreSQL, una clave `service_role` ni un token personal a variables `VITE_*`.
La clave pública puede estar en el navegador porque el acceso a los datos lo
controlan la sesión autenticada y las políticas RLS.

## Publicar y seguir editando

En GitHub, configura estas **Repository variables** en Settings → Secrets and
variables → Actions → Variables, copiando los valores de `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

El workflow existente compila y publica GitHub Pages al subir a `main`. Ya se
incluyó la redirección de autenticación para
https://adrianrburgoa-spec.github.io/react-app/. Si cambias el dominio, agrega la
nueva URL en Supabase → Authentication → URL Configuration. Configura también
la Site URL con la dirección pública al publicar. No edites `dist`: se regenera
desde `src` con `npm.cmd run build`.

Puedes editar `src` y desplegar nuevas versiones sin borrar los datos. Para
cambiar tablas crea una migración nueva, revisa `npx.cmd supabase db push
--dry-run` y aplica con `npx.cmd supabase db push`. Evita `db reset --linked`,
que borraría los datos remotos.

El correo predeterminado de Supabase solo entrega a direcciones del equipo de
la organización y tiene límites de envío; para registrar usuarios externos
configura un proveedor SMTP en Authentication. Documentación:
https://supabase.com/docs/guides/auth/auth-smtp

## Verificación

Se verificaron la compilación, ESLint y las políticas con Supabase CLI. La prueba
`scripts/verify-supabase.mjs` comprueba permisos entre dos cuentas, restricciones,
formularios en Chrome, persistencia y conflictos de edición. Crea usuarios
temporales sin enviar correos y los elimina al terminar. Para ejecutarla se
requiere `SUPABASE_TEST_SERVICE_KEY` solo en el entorno del proceso de prueba:
`node --env-file=.env.local scripts/verify-supabase.mjs`.

`scripts/verify-team.mjs` verifica creación de personal, permisos de administrador
y tatuador, invitaciones, revocación, confirmación manual de citas y cambio de
contraseña en Chrome. Usa las mismas variables y elimina sus cuentas temporales.
