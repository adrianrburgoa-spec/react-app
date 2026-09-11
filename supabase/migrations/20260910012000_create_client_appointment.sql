-- Creates a new client and their first appointment in one transaction. If
-- either insert fails, PostgreSQL rolls back both records automatically.
create function public.create_client_appointment(
  studio_id uuid,
  new_client_name text,
  new_client_phone text,
  new_client_email text,
  new_client_ci text,
  new_client_tag text,
  new_client_artist text,
  new_appointment_date date,
  new_appointment_time time,
  new_appointment_artist text,
  new_appointment_type text,
  new_appointment_status text,
  new_appointment_notes text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  created_client public.clients;
  created_appointment public.appointments;
begin
  if public.studio_role(studio_id) is distinct from 'admin' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.clients (owner_id, name, phone, email, ci, tag, artist)
  values (
    studio_id,
    trim(new_client_name),
    trim(coalesce(new_client_phone, '')),
    trim(coalesce(new_client_email, '')),
    trim(coalesce(new_client_ci, '')),
    new_client_tag,
    new_client_artist
  )
  returning * into created_client;

  insert into public.appointments (owner_id, client_id, date, time, artist, type, status, notes)
  values (
    studio_id,
    created_client.id,
    new_appointment_date,
    new_appointment_time,
    new_appointment_artist,
    new_appointment_type,
    new_appointment_status,
    trim(coalesce(new_appointment_notes, ''))
  )
  returning * into created_appointment;

  return jsonb_build_object(
    'client', to_jsonb(created_client),
    'appointment', to_jsonb(created_appointment)
  );
end;
$$;

revoke all on function public.create_client_appointment(uuid,text,text,text,text,text,text,date,time,text,text,text,text) from public, anon;
grant execute on function public.create_client_appointment(uuid,text,text,text,text,text,text,date,time,text,text,text,text) to authenticated;
