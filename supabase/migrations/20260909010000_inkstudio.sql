-- Each authenticated account owns a private studio dataset.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  phone text not null default '',
  email text not null default '',
  ci text not null default '',
  tag text not null default 'Nueva' check (tag in ('Nueva', 'Activo', 'VIP')),
  artist text not null check (artist in ('Diego Arnez', 'Lucas Méndez', 'Sofía Rojas')),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create unique index clients_owner_ci on public.clients(owner_id, ci) where ci <> '';

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null,
  date date not null,
  time time not null,
  artist text not null check (artist in ('Diego Arnez', 'Lucas Méndez', 'Sofía Rojas')),
  type text not null check (type in ('Blackwork custom', 'Fine line / minimal', 'Realismo & sombras', 'Cover-up / restauro')),
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Confirmada', 'En proceso', 'Completada', 'Cancelada')),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  foreign key (client_id, owner_id) references public.clients(id, owner_id) on delete restrict
);
create unique index appointments_artist_slot on public.appointments(owner_id, date, time, artist) where status <> 'Cancelada';
create index appointments_client on public.appointments(client_id, owner_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null,
  amount numeric(12,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  method text not null check (method in ('Efectivo', 'QR', 'Transferencia')),
  date date not null,
  concept text not null check (length(trim(concept)) > 0),
  updated_at timestamptz not null default now(),
  foreign key (client_id, owner_id) references public.clients(id, owner_id) on delete restrict
);
create index payments_owner_date on public.payments(owner_id, date);
create index payments_client on public.payments(client_id, owner_id);

create table public.studio_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  studio text not null check (length(trim(studio)) > 0),
  address text not null check (length(trim(address)) > 0),
  updated_at timestamptz not null default now()
);

create function public.inkstudio_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.inkstudio_touch_updated_at() from public;

do $$
declare table_name text;
begin
  foreach table_name in array array['clients', 'appointments', 'payments', 'studio_settings'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.inkstudio_touch_updated_at()', table_name);
  end loop;
end;
$$;
