create table if not exists public.app_state (
  id text primary key check (id = 'miranda'),
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null default '{"products":[],"sales":[],"suppliers":[],"purchaseOrders":[],"movements":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
revoke all on public.app_state from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update on public.app_state to authenticated;

drop policy if exists "Miranda users can read store data" on public.app_state;
create policy "Miranda users can read store data"
  on public.app_state for select to authenticated using (true);

drop policy if exists "Miranda users can create store data" on public.app_state;
create policy "Miranda users can create store data"
  on public.app_state for insert to authenticated with check (id = 'miranda');

drop policy if exists "Miranda users can update store data" on public.app_state;
create policy "Miranda users can update store data"
  on public.app_state for update to authenticated using (id = 'miranda') with check (id = 'miranda');

insert into public.app_state (id)
values ('miranda')
on conflict (id) do nothing;
