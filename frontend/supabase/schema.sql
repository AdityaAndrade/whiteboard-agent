-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query) once per project.
-- Creates the single table that backs every saved whiteboard, scoped per-user via RLS.

create table public.whiteboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled workflow',
  description text,
  graph_data jsonb not null default
    '{"nodes":[],"edges":[],"view":{"x":0,"y":0,"z":1}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whiteboards enable row level security;

create policy "select own" on public.whiteboards for select using (auth.uid() = user_id);
create policy "insert own" on public.whiteboards for insert with check (auth.uid() = user_id);
create policy "update own" on public.whiteboards for update using (auth.uid() = user_id);
create policy "delete own" on public.whiteboards for delete using (auth.uid() = user_id);

-- Keep updated_at current on every row update without relying on the client to set it.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger whiteboards_set_updated_at
  before update on public.whiteboards
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Pricing / plans addition — run this section once too (it's written to be
-- safe to re-run). Tracks each user's subscription tier (free vs pro), which
-- gates the saved-workflow limit (2 vs 12) shown on /pricing. New signups are
-- inserted as 'free' automatically by the trigger below — see CLAUDE.md.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles for select using (auth.uid() = user_id);

-- Intentionally no client-facing update policy: an `update ... using (auth.uid()
-- = user_id)` policy without a `with check` would let a user flip their own
-- `plan` to 'pro' for free (the USING clause is reused as the check, and it
-- trivially holds for any new value since user_id is immutable). Plan changes
-- must only ever be made by a trusted server-side process (e.g. a Stripe
-- webhook running with the service_role key), mirroring the "no insert/delete
-- from the client" reasoning above. Drop it in case it was already applied.
drop policy if exists "update own profile" on public.profiles;

-- Gives every new signup a 'free'-plan profile row the instant their
-- auth.users row is created — no separate provisioning step.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, plan) values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: give accounts created before this table existed a free-plan row too.
insert into public.profiles (user_id, plan)
select id, 'free' from auth.users
on conflict (user_id) do nothing;
