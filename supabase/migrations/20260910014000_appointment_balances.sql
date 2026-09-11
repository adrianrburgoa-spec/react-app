alter table public.appointments
  add column total_price numeric(12,2) not null default 0 check (total_price >= 0),
  add constraint appointments_id_owner_unique unique (id, owner_id);

alter table public.payments
  add column appointment_id uuid,
  add constraint payments_appointment_fk
    foreign key (appointment_id, owner_id)
    references public.appointments(id, owner_id)
    on update cascade on delete restrict;

create index payments_appointment on public.payments(appointment_id, owner_id)
  where appointment_id is not null;

-- New overload used by the updated client. The prior signature remains
-- available while an older GitHub Pages bundle is being replaced.
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
  new_appointment_notes text,
  new_appointment_total_price numeric
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
  if not exists (select 1 from public.artists where owner_id = studio_id and name = new_client_artist and active)
    or not exists (select 1 from public.artists where owner_id = studio_id and name = new_appointment_artist and active) then
    raise exception 'El tatuador no existe o está inactivo.' using errcode = '23514';
  end if;

  insert into public.clients (owner_id, name, phone, email, ci, tag, artist)
  values (studio_id, trim(new_client_name), trim(coalesce(new_client_phone, '')), trim(coalesce(new_client_email, '')), trim(coalesce(new_client_ci, '')), new_client_tag, new_client_artist)
  returning * into created_client;

  insert into public.appointments (owner_id, client_id, date, time, artist, type, status, notes, total_price)
  values (studio_id, created_client.id, new_appointment_date, new_appointment_time, new_appointment_artist, new_appointment_type, new_appointment_status, trim(coalesce(new_appointment_notes, '')), new_appointment_total_price)
  returning * into created_appointment;

  return jsonb_build_object('client', to_jsonb(created_client), 'appointment', to_jsonb(created_appointment));
end;
$$;

revoke all on function public.create_client_appointment(uuid,text,text,text,text,text,text,date,time,text,text,text,text,numeric) from public, anon;
grant execute on function public.create_client_appointment(uuid,text,text,text,text,text,text,date,time,text,text,text,text,numeric) to authenticated;
