-- TokenTrim production schema (Supabase / Postgres).
-- Auth (email+password+PIN) is implemented in the Next.js API using these
-- tables, so no Supabase Auth dependency is required. Service-role key only.

create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  name text not null default '',
  plan text not null default 'free' check (plan in ('free', 'pro')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  password_hash text not null,
  pin_hash text not null
);

create table if not exists public.sessions (
  token_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_sessions_user on public.sessions(user_id);
create index if not exists idx_sessions_expires on public.sessions(expires_at);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}',
  session_id text,
  client_version text,
  platform text,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_user_created on public.analytics_events(user_id, created_at desc);
create index if not exists idx_events_name_created on public.analytics_events(event_name, created_at desc);
create index if not exists idx_events_created on public.analytics_events(created_at desc);

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.analytics_events enable row level security;

-- Deny direct client access; the API uses the service-role key.
drop policy if exists deny_all_profiles on public.profiles;
create policy deny_all_profiles on public.profiles for all using (false) with check (false);
drop policy if exists deny_all_sessions on public.sessions;
create policy deny_all_sessions on public.sessions for all using (false) with check (false);
drop policy if exists deny_all_events on public.analytics_events;
create policy deny_all_events on public.analytics_events for all using (false) with check (false);
