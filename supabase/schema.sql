-- SeamlessShop cloud sync + household sharing (Supabase free tier)
-- Run this once in the SQL editor.

-- Personal device sync
create table if not exists public.kitchen_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.kitchen_state enable row level security;

drop policy if exists "Users manage own kitchen state" on public.kitchen_state;
create policy "Users manage own kitchen state"
  on public.kitchen_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Shared household pantry
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx on public.household_members (user_id);
create unique index if not exists households_invite_code_idx on public.households (invite_code);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists "Members read household" on public.households;
create policy "Members read household"
  on public.households for select
  using (
    exists (
      select 1 from public.household_members m
      where m.household_id = households.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members update household" on public.households;
create policy "Members update household"
  on public.households for update
  using (
    exists (
      select 1 from public.household_members m
      where m.household_id = households.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated create household" on public.households;
create policy "Authenticated create household"
  on public.households for insert
  with check (auth.uid() is not null);

drop policy if exists "Members read membership" on public.household_members;
create policy "Members read membership"
  on public.household_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.household_members m
      where m.household_id = household_members.household_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Users insert own membership" on public.household_members;
create policy "Users insert own membership"
  on public.household_members for insert
  with check (user_id = auth.uid());

drop policy if exists "Users leave household" on public.household_members;
create policy "Users leave household"
  on public.household_members for delete
  using (user_id = auth.uid());

-- Allow joining by invite code (bypasses RLS safely)
create or replace function public.join_household(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into h
  from public.households
  where invite_code = upper(trim(p_code));

  if not found then
    raise exception 'Invalid invite code';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (h.id, uid, 'member')
  on conflict do nothing;

  return jsonb_build_object(
    'id', h.id,
    'name', h.name,
    'invite_code', h.invite_code,
    'payload', h.payload
  );
end;
$$;

grant execute on function public.join_household(text) to authenticated;
