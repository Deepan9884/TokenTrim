-- TokenTrim user documents schema (Supabase / Postgres).
-- Stores user-converted documents and chunks synced from the extension.
-- Access is controlled server-side by Next.js API using the service-role key.

create table if not exists public.user_documents (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  preset text not null default 'claude',
  markdown text not null,
  chunks jsonb not null default '[]'::jsonb,
  pages integer not null default 0,
  tokens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_user_created on public.user_documents(user_id, created_at desc);
create index if not exists idx_documents_created on public.user_documents(created_at desc);

alter table public.user_documents enable row level security;

-- Deny direct client access; API uses service-role key
drop policy if exists deny_all_documents on public.user_documents;
create policy deny_all_documents on public.user_documents for all using (false) with check (false);
