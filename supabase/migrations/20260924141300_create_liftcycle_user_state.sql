-- Run on a NEW, EMPTY Supabase project. This migration is already applied
-- to the user's Personal > liftcycle project.
create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  schema_version integer not null default 3,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_app_state enable row level security;
create policy "Users can read own LiftCycle state" on public.user_app_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own LiftCycle state" on public.user_app_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own LiftCycle state" on public.user_app_state
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own LiftCycle state" on public.user_app_state
  for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.set_liftcycle_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger set_user_app_state_updated_at before update on public.user_app_state
  for each row execute function public.set_liftcycle_updated_at();
grant select, insert, update, delete on public.user_app_state to authenticated;
alter publication supabase_realtime add table public.user_app_state;
