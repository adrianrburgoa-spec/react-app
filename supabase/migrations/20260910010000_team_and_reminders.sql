-- owner_id remains the studio identifier; existing records keep their owner.
create table public.studio_members (
  owner_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','artist')),
  artist text check (artist in ('Diego Arnez','Lucas Méndez','Sofía Rojas')),
  primary key(owner_id,user_id),
  check(owner_id <> user_id),
  check(role <> 'artist' or artist is not null)
);
create index studio_members_user on public.studio_members(user_id);
alter table public.studio_members enable row level security;

create function public.studio_role(studio_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when studio_id = (select auth.uid()) then 'admin'
    else (select m.role from public.studio_members m where m.owner_id=studio_id and m.user_id=(select auth.uid())) end;
$$;
revoke all on function public.studio_role(uuid) from public;
grant execute on function public.studio_role(uuid) to authenticated;
revoke all on public.studio_members from anon, authenticated;
grant select, delete on public.studio_members to authenticated;
create policy member_read on public.studio_members for select to authenticated using (public.studio_role(owner_id) is not null);
create policy member_remove on public.studio_members for delete to authenticated using (public.studio_role(owner_id)='admin');

create function public.list_studios() returns table(owner_id uuid, studio text, role text, artist text)
language sql stable security definer set search_path = '' as $$
  select u.id, coalesce(s.studio,'Mi estudio'), 'admin'::text, null::text
  from auth.users u left join public.studio_settings s on s.owner_id=u.id where u.id=(select auth.uid())
  union all
  select m.owner_id, coalesce(s.studio,'Estudio compartido'), m.role, m.artist
  from public.studio_members m left join public.studio_settings s on s.owner_id=m.owner_id where m.user_id=(select auth.uid());
$$;
revoke all on function public.list_studios() from public;
grant execute on function public.list_studios() to authenticated;

create function public.list_studio_members(studio_id uuid) returns table(user_id uuid, email text, role text, artist text, is_owner boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.studio_role(studio_id) <> 'admin' or public.studio_role(studio_id) is null then raise exception 'Not authorized' using errcode='42501'; end if;
  return query select u.id,u.email::text,'admin'::text,null::text,true from auth.users u where u.id=studio_id
  union all select m.user_id,u.email::text,m.role,m.artist,false from public.studio_members m join auth.users u on u.id=m.user_id where m.owner_id=studio_id;
end; $$;
revoke all on function public.list_studio_members(uuid) from public;
grant execute on function public.list_studio_members(uuid) to authenticated;

create table public.studio_invites (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique,
 role text not null check(role in ('admin','artist')),
 artist text check(artist in ('Diego Arnez','Lucas Méndez','Sofía Rojas')),
 expires_at timestamptz not null default now()+interval '7 days',
 consumed_at timestamptz,
 check(role <> 'artist' or artist is not null)
);
alter table public.studio_invites enable row level security;
revoke all on public.studio_invites from anon, authenticated;
grant select(id,owner_id,role,artist,expires_at,consumed_at),delete on public.studio_invites to authenticated;
create policy invite_admin_read on public.studio_invites for select to authenticated using (public.studio_role(owner_id)='admin');
create policy invite_admin_delete on public.studio_invites for delete to authenticated using (public.studio_role(owner_id)='admin');

create function public.create_studio_invite(studio_id uuid, member_role text, member_artist text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
 if public.studio_role(studio_id) is distinct from 'admin' then raise exception 'Not authorized' using errcode='42501'; end if;
 insert into public.studio_invites(owner_id,token_hash,role,artist) values(studio_id,encode(sha256(convert_to(token,'UTF8')),'hex'),member_role,member_artist);
 return token;
end; $$;
revoke all on function public.create_studio_invite(uuid,text,text) from public;
grant execute on function public.create_studio_invite(uuid,text,text) to authenticated;

create function public.accept_studio_invite(invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation public.studio_invites;
begin
 if (select auth.uid()) is null then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into invitation from public.studio_invites where token_hash=encode(sha256(convert_to(trim(invite_code),'UTF8')),'hex') and consumed_at is null and expires_at>now() for update;
 if not found then raise exception 'Invitación inválida, vencida o ya utilizada.'; end if;
 if invitation.owner_id=(select auth.uid()) then raise exception 'Ya eres propietario del estudio.'; end if;
 insert into public.studio_members(owner_id,user_id,role,artist) values(invitation.owner_id,(select auth.uid()),invitation.role,invitation.artist);
 update public.studio_invites set consumed_at=now() where id=invitation.id;
 return invitation.owner_id;
end; $$;
revoke all on function public.accept_studio_invite(text) from public;
grant execute on function public.accept_studio_invite(text) to authenticated;

do $$ declare t text; begin
 foreach t in array array['clients','appointments','payments','studio_settings'] loop
  execute format('drop policy owner_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using (public.studio_role(owner_id)=''admin'') with check (public.studio_role(owner_id)=''admin'')',t);
  if t <> 'payments' then
   execute format('create policy team_read on public.%I for select to authenticated using (public.studio_role(owner_id) is not null)',t);
  end if;
 end loop;
end $$;

-- Artists can update only status/notes of their assigned appointments. No
-- direct UPDATE policy is granted to them, preventing changes to other fields.
create function public.update_artist_appointment(appointment_id uuid, expected_version timestamptz, new_status text, new_notes text)
returns public.appointments language plpgsql security definer set search_path = '' as $$
declare result public.appointments;
begin
 update public.appointments a set status=new_status,notes=new_notes
 where a.id=appointment_id and a.updated_at=expected_version
 and exists(select 1 from public.studio_members m where m.owner_id=a.owner_id and m.user_id=(select auth.uid()) and m.role='artist' and m.artist=a.artist)
 returning a.* into result;
 if not found then raise exception 'La cita cambió o no está asignada a tu cuenta.' using errcode='42501'; end if;
 return result;
end; $$;
revoke all on function public.update_artist_appointment(uuid,timestamptz,text,text) from public;
grant execute on function public.update_artist_appointment(uuid,timestamptz,text,text) to authenticated;
