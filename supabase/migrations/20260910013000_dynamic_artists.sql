create table public.artists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

insert into public.artists (owner_id, name)
select users.id, defaults.name
from auth.users users
cross join (values ('Diego Arnez'), ('Lucas Méndez'), ('Sofía Rojas')) defaults(name)
on conflict (owner_id, name) do nothing;

alter table public.clients drop constraint if exists clients_artist_check;
alter table public.appointments drop constraint if exists appointments_artist_check;
alter table public.studio_members drop constraint if exists studio_members_artist_check;
alter table public.studio_invites drop constraint if exists studio_invites_artist_check;

alter table public.clients add constraint clients_artist_fk
  foreign key (owner_id, artist) references public.artists(owner_id, name) on update cascade;
alter table public.appointments add constraint appointments_artist_fk
  foreign key (owner_id, artist) references public.artists(owner_id, name) on update cascade;
alter table public.studio_members add constraint studio_members_artist_fk
  foreign key (owner_id, artist) references public.artists(owner_id, name) on update cascade;
alter table public.studio_invites add constraint studio_invites_artist_fk
  foreign key (owner_id, artist) references public.artists(owner_id, name) on update cascade;

alter table public.artists enable row level security;
revoke all on public.artists from anon, authenticated;
grant select, insert, update, delete on public.artists to authenticated;
create policy artist_admin_access on public.artists for all to authenticated
  using (public.studio_role(owner_id) = 'admin')
  with check (public.studio_role(owner_id) = 'admin');
create policy artist_team_read on public.artists for select to authenticated
  using (public.studio_role(owner_id) is not null);
create trigger touch_updated_at before update on public.artists
  for each row execute function public.inkstudio_touch_updated_at();

create or replace function public.create_studio_invite(studio_id uuid, member_role text, member_artist text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
 if public.studio_role(studio_id) is distinct from 'admin' then raise exception 'Not authorized' using errcode='42501'; end if;
 if member_role = 'artist' and not exists (
   select 1 from public.artists where owner_id = studio_id and name = member_artist and active
 ) then raise exception 'El tatuador no existe o está inactivo.' using errcode='23514'; end if;
 insert into public.studio_invites(owner_id,token_hash,role,artist) values(studio_id,encode(sha256(convert_to(token,'UTF8')),'hex'),member_role,member_artist);
 return token;
end; $$;

-- Recreate the combined operation so both selected artists must still be active.
create or replace function public.create_client_appointment(
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
  if not exists (select 1 from public.artists where owner_id = studio_id and name = new_client_artist and active)
    or not exists (select 1 from public.artists where owner_id = studio_id and name = new_appointment_artist and active) then
    raise exception 'El tatuador no existe o está inactivo.' using errcode = '23514';
  end if;

  insert into public.clients (owner_id, name, phone, email, ci, tag, artist)
  values (studio_id, trim(new_client_name), trim(coalesce(new_client_phone, '')), trim(coalesce(new_client_email, '')), trim(coalesce(new_client_ci, '')), new_client_tag, new_client_artist)
  returning * into created_client;

  insert into public.appointments (owner_id, client_id, date, time, artist, type, status, notes)
  values (studio_id, created_client.id, new_appointment_date, new_appointment_time, new_appointment_artist, new_appointment_type, new_appointment_status, trim(coalesce(new_appointment_notes, '')))
  returning * into created_appointment;

  return jsonb_build_object('client', to_jsonb(created_client), 'appointment', to_jsonb(created_appointment));
end;
$$;

revoke all on public.artists from anon;
