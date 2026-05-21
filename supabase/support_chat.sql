create extension if not exists pgcrypto;

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  case_id text unique,
  visitor_id text not null unique,
  status text not null default 'bot',
  assigned_agent text default '',
  agent_requested boolean not null default false,
  unread_for_agent integer not null default 0,
  unread_for_visitor integer not null default 0,
  last_message text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_conversations
  add column if not exists case_id text;

create unique index if not exists support_conversations_case_id_idx
  on public.support_conversations (case_id)
  where case_id is not null;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'bot', 'agent', 'system')),
  author text default '',
  text text default '',
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'delivered',
  created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_created_idx
  on public.support_messages (conversation_id, created_at);

create index if not exists support_conversations_updated_idx
  on public.support_conversations (updated_at desc);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support conversations anon access" on public.support_conversations;
create policy "support conversations anon access"
  on public.support_conversations
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "support messages anon access" on public.support_messages;
create policy "support messages anon access"
  on public.support_messages
  for all
  to anon
  using (true)
  with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception
    when duplicate_object then null;
  end;
end $$;
