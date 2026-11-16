-- Additive migration for the existing LaquTum user_progress table.
begin;
alter table public.user_progress add column if not exists mistake_notebook jsonb default '[]'::jsonb;
alter table public.user_progress add column if not exists route_state jsonb;
alter table public.user_progress add column if not exists is_admin boolean default false;
alter table public.user_progress add column if not exists is_banned boolean default false;

alter table public.user_progress enable row level security;
drop policy if exists progress_owner on public.user_progress;
create policy progress_owner on public.user_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Restrictive policy also constrains any pre-existing broad policy.
drop policy if exists progress_owner_guard on public.user_progress;
create policy progress_owner_guard on public.user_progress as restrictive for all to public
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists progress_no_client_delete on public.user_progress;
create policy progress_no_client_delete on public.user_progress as restrictive for delete to authenticated using (false);

create or replace function public.guard_progress_privileges() returns trigger language plpgsql as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) or coalesce(new.is_banned, false) then raise exception 'Protected profile fields'; end if;
  else
    if new.is_admin is distinct from old.is_admin or new.is_banned is distinct from old.is_banned then raise exception 'Protected profile fields'; end if;
    if to_jsonb(new.unlocked_topics) is not distinct from to_jsonb(old.unlocked_topics) then return new; end if;
    if not (coalesce(to_jsonb(new.unlocked_topics), '[]'::jsonb) @> coalesce(to_jsonb(old.unlocked_topics), '[]'::jsonb)) then raise exception 'Existing topic choices cannot be replaced'; end if;
  end if;
  if jsonb_typeof(coalesce(to_jsonb(new.unlocked_topics), '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(to_jsonb(new.unlocked_topics), '[]'::jsonb)) > 2
    or coalesce(to_jsonb(new.unlocked_topics), '[]'::jsonb) ?| array['*','all'] then
    raise exception 'Paid access must be granted by the payment service';
  end if;
  return new;
end $$;
drop trigger if exists protect_progress_privileges on public.user_progress;
create trigger protect_progress_privileges before insert or update on public.user_progress
  for each row execute function public.guard_progress_privileges();

create table if not exists public.payment_orders (
  id text primary key, user_id uuid not null references auth.users(id),
  amount integer not null check (amount = 149900), payment_id text unique,
  fulfilled_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.placement_passes (
  user_id uuid primary key references auth.users(id), expires_at timestamptz not null
);
alter table public.payment_orders enable row level security;
alter table public.placement_passes enable row level security;
revoke all on public.payment_orders, public.placement_passes from anon, authenticated;
grant select on public.placement_passes to authenticated;
grant all on public.payment_orders, public.placement_passes to service_role;
create policy own_pass on public.placement_passes for select to authenticated using (user_id = auth.uid());

create or replace function public.fulfill_placement_pass(order_ref text, payment_ref text, learner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare purchase public.payment_orders;
begin
  select * into purchase from payment_orders where id = order_ref and user_id = learner for update;
  if not found then raise exception 'Unknown order'; end if;
  if purchase.fulfilled_at is not null then return; end if;
  insert into placement_passes(user_id, expires_at) values (learner, now() + interval '6 months')
    on conflict (user_id) do update set expires_at = greatest(placement_passes.expires_at, now()) + interval '6 months';
  update payment_orders set payment_id = payment_ref, fulfilled_at = now() where id = order_ref;
end $$;
revoke all on function public.fulfill_placement_pass(text, text, uuid) from public, anon, authenticated;
grant execute on function public.fulfill_placement_pass(text, text, uuid) to service_role;

create table if not exists public.mentor_usage (
  user_id uuid not null references auth.users(id), day date not null, requests integer not null,
  primary key (user_id, day)
);
alter table public.mentor_usage enable row level security;
revoke all on public.mentor_usage from anon, authenticated;
create or replace function public.consume_mentor_quota(learner uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  insert into mentor_usage(user_id, day, requests) values (learner, (now() at time zone 'UTC')::date, 1)
    on conflict (user_id, day) do update set requests = mentor_usage.requests + 1
      where mentor_usage.requests < 100 returning requests into total;
  return total is not null;
end $$;
revoke all on function public.consume_mentor_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_mentor_quota(uuid) to service_role;
commit;
