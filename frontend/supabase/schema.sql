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
$$ language plpgsql set search_path = public;

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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: give accounts created before this table existed a free-plan row too.
insert into public.profiles (user_id, plan)
select id, 'free' from auth.users
on conflict (user_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Brainstorm long-term memory — kept in its own table rather than a column
-- on profiles so we can give it select/insert/update policies without
-- opening up profiles.plan to client writes (no column-level RLS in PG).
-- Each row holds a JSONB array of short fact strings (capped at 20 by the
-- app). Run this section once (safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.brainstorm_memories (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  entries   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.brainstorm_memories enable row level security;

drop policy if exists "select own memory" on public.brainstorm_memories;
drop policy if exists "insert own memory" on public.brainstorm_memories;
drop policy if exists "update own memory" on public.brainstorm_memories;

create policy "select own memory" on public.brainstorm_memories for select using (auth.uid() = user_id);
create policy "insert own memory" on public.brainstorm_memories for insert with check (auth.uid() = user_id);
create policy "update own memory" on public.brainstorm_memories for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Stripe billing columns — added to profiles so the webhook edge function
-- can link a Stripe customer/subscription back to a Supabase user.
-- Written to be safe to re-run (alter column if not exists pattern).
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'stripe_customer_id'
  ) then
    alter table public.profiles add column stripe_customer_id text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'stripe_subscription_id'
  ) then
    alter table public.profiles add column stripe_subscription_id text;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Brainstorm monthly usage tracking — server-side cap enforcement.
-- Each row tracks the current calendar-month message count for one Pro user.
-- The count is incremented atomically via a security-definer RPC so the
-- client can read its own count but can never write it directly.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.brainstorm_usage (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  period_start date not null default (date_trunc('month', now())::date),
  count        int  not null default 0
);

alter table public.brainstorm_usage enable row level security;

drop policy if exists "select own usage" on public.brainstorm_usage;
create policy "select own usage" on public.brainstorm_usage
  for select using (auth.uid() = user_id);

-- Atomically increments this month's count and returns the new value.
-- Resets automatically when the calendar month rolls over.
-- Uses security definer so the counter can never be manipulated from the client.
-- anon cannot call this; authenticated users can (the function enforces auth.uid() internally).
create or replace function public.increment_brainstorm_usage()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  uid         uuid := auth.uid();
  this_period date := date_trunc('month', now())::date;
  new_count   int;
begin
  if uid is null then raise exception 'Unauthorized'; end if;

  insert into brainstorm_usage (user_id, period_start, count)
    values (uid, this_period, 1)
  on conflict (user_id) do update set
    count        = case
                     when brainstorm_usage.period_start < this_period then 1
                     else brainstorm_usage.count + 1
                   end,
    period_start = this_period
  returning count into new_count;

  return new_count;
end;
$$;

revoke execute on function public.increment_brainstorm_usage() from public, anon;
grant execute on function public.increment_brainstorm_usage() to authenticated;
