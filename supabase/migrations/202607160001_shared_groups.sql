create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  invite_token_hash text not null,
  invite_enabled boolean not null default true,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  position integer not null check (position >= 0),
  unique (id, group_id),
  unique (group_id, name),
  unique (group_id, position)
);

create table public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null,
  role text not null check (role in ('owner', 'editor')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  foreign key (member_id, group_id)
    references public.members(id, group_id)
    on delete no action deferrable initially deferred
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  payer_member_id uuid not null,
  amount bigint not null check (amount between 0 and 9007199254740991),
  version bigint not null default 1 check (version > 0),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id),
  foreign key (payer_member_id, group_id)
    references public.members(id, group_id)
    on delete no action deferrable initially deferred
);

create table public.payment_participants (
  payment_id uuid not null,
  group_id uuid not null references public.groups(id) on delete cascade,
  member_id uuid not null,
  position integer not null check (position >= 0),
  primary key (payment_id, member_id),
  unique (payment_id, position),
  foreign key (payment_id, group_id)
    references public.payments(id, group_id) on delete cascade,
  foreign key (member_id, group_id)
    references public.members(id, group_id)
    on delete no action deferrable initially deferred
);

create table public.settlement_transfers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_member_id uuid not null,
  to_member_id uuid not null,
  amount bigint not null check (amount between 1 and 9007199254740991),
  version bigint not null default 1 check (version > 0),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, group_id),
  check (from_member_id <> to_member_id),
  foreign key (from_member_id, group_id)
    references public.members(id, group_id)
    on delete no action deferrable initially deferred,
  foreign key (to_member_id, group_id)
    references public.members(id, group_id)
    on delete no action deferrable initially deferred
);

create index group_memberships_user_id_idx
  on public.group_memberships(user_id);
create index payments_group_id_idx on public.payments(group_id);
create index payment_participants_group_id_idx
  on public.payment_participants(group_id);
create index settlement_transfers_group_id_idx
  on public.settlement_transfers(group_id);

create or replace function private.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_memberships membership
    where membership.group_id = target_group_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function private.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_memberships membership
    where membership.group_id = target_group_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
  );
$$;

create or replace function private.new_invite_token()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

create or replace function private.invite_hash(invite_token text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(invite_token, 'sha256'), 'hex');
$$;

create or replace function private.normalized_names(member_names text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(btrim(name) order by ordinal), array[]::text[])
  from unnest(member_names) with ordinality as input(name, ordinal);
$$;

create or replace function private.validate_member_names(member_names text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if cardinality(member_names) < 2 then
    raise exception using errcode = '22023', message = 'members_too_short';
  end if;

  if exists (
    select 1 from unnest(member_names) as input(name)
    where char_length(name) = 0
  ) then
    raise exception using errcode = '22023', message = 'member_name_empty';
  end if;

  if (
    select count(distinct name)
    from unnest(member_names) as input(name)
  )
    <> cardinality(member_names) then
    raise exception using errcode = '22023', message = 'member_name_duplicate';
  end if;
end;
$$;

create or replace function private.assert_authenticated()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  return current_user_id;
end;
$$;

create or replace function private.assert_group_member(target_group_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_authenticated();
begin
  if not private.is_group_member(target_group_id) then
    raise exception using errcode = '42501', message = 'group_membership_required';
  end if;
  return current_user_id;
end;
$$;

create or replace function private.assert_group_owner(target_group_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_authenticated();
begin
  if not private.is_group_owner(target_group_id) then
    raise exception using errcode = '42501', message = 'group_owner_required';
  end if;
  return current_user_id;
end;
$$;

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.group_memberships enable row level security;
alter table public.payments enable row level security;
alter table public.payment_participants enable row level security;
alter table public.settlement_transfers enable row level security;

create policy groups_select_for_members
on public.groups for select to authenticated
using (private.is_group_member(id));

create policy members_select_for_members
on public.members for select to authenticated
using (private.is_group_member(group_id));

create policy memberships_select_for_members
on public.group_memberships for select to authenticated
using (private.is_group_member(group_id));

create policy payments_select_for_members
on public.payments for select to authenticated
using (private.is_group_member(group_id));

create policy payment_participants_select_for_members
on public.payment_participants for select to authenticated
using (private.is_group_member(group_id));

create policy settlement_transfers_select_for_members
on public.settlement_transfers for select to authenticated
using (private.is_group_member(group_id));

revoke all on public.groups from anon, authenticated;
revoke all on public.members from anon, authenticated;
revoke all on public.group_memberships from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.payment_participants from anon, authenticated;
revoke all on public.settlement_transfers from anon, authenticated;

grant select on public.groups to authenticated;
grant select on public.members to authenticated;
grant select on public.group_memberships to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_participants to authenticated;
grant select on public.settlement_transfers to authenticated;

create or replace function public.create_group(
  group_name text,
  member_names text[],
  self_member_name text
)
returns table (group_id uuid, invite_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_authenticated();
  normalized_group_name text := btrim(group_name);
  normalized_member_names text[] := private.normalized_names(member_names);
  normalized_self_name text := btrim(self_member_name);
  created_group_id uuid;
  created_token text := private.new_invite_token();
  self_member_id uuid;
begin
  if char_length(normalized_group_name) = 0 then
    raise exception using errcode = '22023', message = 'group_name_empty';
  end if;

  perform private.validate_member_names(normalized_member_names);

  if not normalized_self_name = any(normalized_member_names) then
    raise exception using errcode = '22023', message = 'self_member_invalid';
  end if;

  insert into public.groups (name, owner_user_id, invite_token_hash)
  values (
    normalized_group_name,
    current_user_id,
    private.invite_hash(created_token)
  )
  returning id into created_group_id;

  insert into public.members (group_id, name, position)
  select created_group_id, name, ordinal - 1
  from unnest(normalized_member_names) with ordinality as input(name, ordinal);

  select id into self_member_id
  from public.members
  where members.group_id = created_group_id
    and members.name = normalized_self_name;

  insert into public.group_memberships (group_id, user_id, member_id, role)
  values (created_group_id, current_user_id, self_member_id, 'owner');

  return query select created_group_id, created_token;
end;
$$;

create or replace function public.inspect_invite(invite_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  ignored_user_id uuid := private.assert_authenticated();
  target_group_id uuid;
  result jsonb;
begin
  select groups.id into target_group_id
  from public.groups
  where groups.invite_enabled
    and groups.invite_token_hash = private.invite_hash(invite_token);

  if target_group_id is null then
    raise exception using errcode = '22023', message = 'invite_invalid';
  end if;

  select jsonb_build_object(
    'groupId', groups.id,
    'groupName', groups.name,
    'members', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('id', members.id, 'name', members.name)
          order by members.position
        ),
        '[]'::jsonb
      )
      from public.members
      where members.group_id = groups.id
    )
  ) into result
  from public.groups
  where groups.id = target_group_id;

  return result;
end;
$$;

create or replace function public.join_group(invite_token text, selected_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_authenticated();
  target_group_id uuid;
begin
  select groups.id into target_group_id
  from public.groups
  where groups.invite_enabled
    and groups.invite_token_hash = private.invite_hash(invite_token)
  for update;

  if target_group_id is null then
    raise exception using errcode = '22023', message = 'invite_invalid';
  end if;

  if not exists (
    select 1 from public.members
    where members.id = selected_member_id
      and members.group_id = target_group_id
  ) then
    raise exception using errcode = '22023', message = 'self_member_invalid';
  end if;

  insert into public.group_memberships (group_id, user_id, member_id, role)
  values (target_group_id, current_user_id, selected_member_id, 'editor')
  on conflict (group_id, user_id) do update
    set member_id = excluded.member_id;

  return target_group_id;
end;
$$;

create or replace function public.get_group_snapshot(target_group_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_group_member(target_group_id);
  result jsonb;
begin
  select jsonb_build_object(
    'group', jsonb_build_object(
      'id', groups.id,
      'name', groups.name,
      'revision', groups.revision,
      'role', membership.role,
      'currentMemberId', membership.member_id,
      'inviteEnabled', groups.invite_enabled
    ),
    'members', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', members.id,
            'name', members.name,
            'position', members.position
          ) order by members.position
        ),
        '[]'::jsonb
      )
      from public.members
      where members.group_id = groups.id
    ),
    'payments', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', payments.id,
            'title', payments.title,
            'payerMemberId', payments.payer_member_id,
            'amount', payments.amount,
            'beneficiaryMemberIds', (
              select coalesce(
                jsonb_agg(participants.member_id order by participants.position),
                '[]'::jsonb
              )
              from public.payment_participants participants
              where participants.payment_id = payments.id
            ),
            'version', payments.version,
            'createdByMemberId', creator_membership.member_id,
            'createdAt', payments.created_at,
            'updatedAt', payments.updated_at
          ) order by payments.created_at, payments.id
        ),
        '[]'::jsonb
      )
      from public.payments
      left join public.group_memberships creator_membership
        on creator_membership.group_id = payments.group_id
       and creator_membership.user_id = payments.created_by_user_id
      where payments.group_id = groups.id
    ),
    'transfers', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', transfers.id,
            'fromMemberId', transfers.from_member_id,
            'toMemberId', transfers.to_member_id,
            'amount', transfers.amount,
            'version', transfers.version,
            'createdByMemberId', creator_membership.member_id,
            'createdAt', transfers.created_at
          ) order by transfers.created_at, transfers.id
        ),
        '[]'::jsonb
      )
      from public.settlement_transfers transfers
      left join public.group_memberships creator_membership
        on creator_membership.group_id = transfers.group_id
       and creator_membership.user_id = transfers.created_by_user_id
      where transfers.group_id = groups.id
    )
  ) into result
  from public.groups groups
  join public.group_memberships membership
    on membership.group_id = groups.id
   and membership.user_id = current_user_id
  where groups.id = target_group_id;

  return result;
end;
$$;

create or replace function private.validate_payment_input(
  target_group_id uuid,
  payment_title text,
  payer_id uuid,
  payment_amount bigint,
  beneficiary_ids uuid[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if char_length(btrim(payment_title)) = 0 then
    raise exception using errcode = '22023', message = 'payment_title_empty';
  end if;
  if payment_amount < 0 or payment_amount > 9007199254740991 then
    raise exception using errcode = '22023', message = 'payment_amount_invalid';
  end if;
  if coalesce(cardinality(beneficiary_ids), 0) < 1 then
    raise exception using errcode = '22023', message = 'beneficiaries_empty';
  end if;
  if (
    select count(distinct id)
    from unnest(beneficiary_ids) as input(id)
  )
    <> cardinality(beneficiary_ids) then
    raise exception using errcode = '22023', message = 'beneficiaries_duplicate';
  end if;
  if not exists (
    select 1 from public.members
    where members.id = payer_id and members.group_id = target_group_id
  ) then
    raise exception using errcode = '22023', message = 'payer_invalid';
  end if;
  if exists (
    select 1 from unnest(beneficiary_ids) as beneficiary_id
    where not exists (
      select 1 from public.members
      where members.id = beneficiary_id
        and members.group_id = target_group_id
    )
  ) then
    raise exception using errcode = '22023', message = 'beneficiary_invalid';
  end if;
end;
$$;

create or replace function public.create_payment(
  target_group_id uuid,
  payment_title text,
  payer_id uuid,
  payment_amount bigint,
  beneficiary_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_group_member(target_group_id);
  created_payment_id uuid;
begin
  perform private.validate_payment_input(
    target_group_id,
    payment_title,
    payer_id,
    payment_amount,
    beneficiary_ids
  );

  insert into public.payments (
    group_id, title, payer_member_id, amount,
    created_by_user_id, updated_by_user_id
  ) values (
    target_group_id, btrim(payment_title), payer_id, payment_amount,
    current_user_id, current_user_id
  ) returning id into created_payment_id;

  insert into public.payment_participants (
    payment_id, group_id, member_id, position
  )
  select created_payment_id, target_group_id, member_id, ordinal - 1
  from unnest(beneficiary_ids) with ordinality as input(member_id, ordinal);

  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;

  return created_payment_id;
end;
$$;

create or replace function public.update_payment(
  target_payment_id uuid,
  expected_version bigint,
  payment_title text,
  payer_id uuid,
  payment_amount bigint,
  beneficiary_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_authenticated();
  target_group_id uuid;
  current_version bigint;
begin
  select payments.group_id, payments.version
  into target_group_id, current_version
  from public.payments
  where payments.id = target_payment_id
  for update;

  if target_group_id is null or not private.is_group_member(target_group_id) then
    raise exception using errcode = '42501', message = 'group_membership_required';
  end if;
  if current_version <> expected_version then
    raise exception using errcode = '40001', message = 'payment_conflict';
  end if;

  perform private.validate_payment_input(
    target_group_id,
    payment_title,
    payer_id,
    payment_amount,
    beneficiary_ids
  );

  update public.payments
  set title = btrim(payment_title),
      payer_member_id = payer_id,
      amount = payment_amount,
      version = version + 1,
      updated_by_user_id = current_user_id,
      updated_at = now()
  where id = target_payment_id;

  delete from public.payment_participants
  where payment_id = target_payment_id;

  insert into public.payment_participants (
    payment_id, group_id, member_id, position
  )
  select target_payment_id, target_group_id, member_id, ordinal - 1
  from unnest(beneficiary_ids) with ordinality as input(member_id, ordinal);

  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.delete_payment(
  target_payment_id uuid,
  expected_version bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
  current_version bigint;
begin
  perform private.assert_authenticated();

  select payments.group_id, payments.version
  into target_group_id, current_version
  from public.payments
  where payments.id = target_payment_id
  for update;

  if target_group_id is null or not private.is_group_member(target_group_id) then
    raise exception using errcode = '42501', message = 'group_membership_required';
  end if;
  if current_version <> expected_version then
    raise exception using errcode = '40001', message = 'payment_conflict';
  end if;

  delete from public.payments where id = target_payment_id;
  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.record_settlement_transfer(
  target_group_id uuid,
  from_member_id uuid,
  to_member_id uuid,
  transfer_amount bigint,
  expected_revision bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_group_member(target_group_id);
  current_revision bigint;
  created_transfer_id uuid;
begin
  select revision into current_revision
  from public.groups
  where id = target_group_id
  for update;

  if current_revision <> expected_revision then
    raise exception using errcode = '40001', message = 'settlement_conflict';
  end if;
  if transfer_amount < 1 or transfer_amount > 9007199254740991 then
    raise exception using errcode = '22023', message = 'transfer_amount_invalid';
  end if;
  if from_member_id = to_member_id then
    raise exception using errcode = '22023', message = 'transfer_members_invalid';
  end if;
  if (
    select count(*) from public.members
    where members.group_id = target_group_id
      and members.id in (from_member_id, to_member_id)
  ) <> 2 then
    raise exception using errcode = '22023', message = 'transfer_members_invalid';
  end if;

  insert into public.settlement_transfers (
    group_id, from_member_id, to_member_id, amount, created_by_user_id
  ) values (
    target_group_id, from_member_id, to_member_id,
    transfer_amount, current_user_id
  ) returning id into created_transfer_id;

  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;

  return created_transfer_id;
end;
$$;

create or replace function public.delete_settlement_transfer(
  target_transfer_id uuid,
  expected_version bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
  current_version bigint;
begin
  perform private.assert_authenticated();

  select transfers.group_id, transfers.version
  into target_group_id, current_version
  from public.settlement_transfers transfers
  where transfers.id = target_transfer_id
  for update;

  if target_group_id is null or not private.is_group_member(target_group_id) then
    raise exception using errcode = '42501', message = 'group_membership_required';
  end if;
  if current_version <> expected_version then
    raise exception using errcode = '40001', message = 'transfer_conflict';
  end if;

  delete from public.settlement_transfers where id = target_transfer_id;
  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.change_my_member(
  target_group_id uuid,
  selected_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := private.assert_group_member(target_group_id);
begin
  if not exists (
    select 1 from public.members
    where members.id = selected_member_id
      and members.group_id = target_group_id
  ) then
    raise exception using errcode = '22023', message = 'self_member_invalid';
  end if;

  update public.group_memberships
  set member_id = selected_member_id
  where group_id = target_group_id and user_id = current_user_id;

  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.update_group_name(
  target_group_id uuid,
  group_name text,
  expected_revision bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
begin
  perform private.assert_group_owner(target_group_id);
  if char_length(btrim(group_name)) = 0 then
    raise exception using errcode = '22023', message = 'group_name_empty';
  end if;

  select revision into current_revision
  from public.groups where id = target_group_id for update;
  if current_revision <> expected_revision then
    raise exception using errcode = '40001', message = 'group_conflict';
  end if;

  update public.groups
  set name = btrim(group_name), revision = revision + 1, updated_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.add_member(
  target_group_id uuid,
  member_name text,
  expected_revision bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  next_position integer;
  created_member_id uuid;
begin
  perform private.assert_group_owner(target_group_id);
  if char_length(btrim(member_name)) = 0 then
    raise exception using errcode = '22023', message = 'member_name_empty';
  end if;

  select revision into current_revision
  from public.groups where id = target_group_id for update;
  if current_revision <> expected_revision then
    raise exception using errcode = '40001', message = 'group_conflict';
  end if;
  if exists (
    select 1 from public.members
    where group_id = target_group_id and name = btrim(member_name)
  ) then
    raise exception using errcode = '22023', message = 'member_name_duplicate';
  end if;

  select coalesce(max(position), -1) + 1 into next_position
  from public.members where group_id = target_group_id;

  insert into public.members (group_id, name, position)
  values (target_group_id, btrim(member_name), next_position)
  returning id into created_member_id;

  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;

  return created_member_id;
end;
$$;

create or replace function public.rename_member(
  target_group_id uuid,
  target_member_id uuid,
  member_name text,
  expected_revision bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
begin
  perform private.assert_group_owner(target_group_id);
  if char_length(btrim(member_name)) = 0 then
    raise exception using errcode = '22023', message = 'member_name_empty';
  end if;

  select revision into current_revision
  from public.groups where id = target_group_id for update;
  if current_revision <> expected_revision then
    raise exception using errcode = '40001', message = 'group_conflict';
  end if;
  if not exists (
    select 1 from public.members
    where id = target_member_id and group_id = target_group_id
  ) then
    raise exception using errcode = '22023', message = 'member_invalid';
  end if;
  if exists (
    select 1 from public.members
    where group_id = target_group_id
      and name = btrim(member_name)
      and id <> target_member_id
  ) then
    raise exception using errcode = '22023', message = 'member_name_duplicate';
  end if;

  update public.members set name = btrim(member_name)
  where id = target_member_id and group_id = target_group_id;
  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.delete_member(
  target_group_id uuid,
  target_member_id uuid,
  expected_revision bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
begin
  perform private.assert_group_owner(target_group_id);
  select revision into current_revision
  from public.groups where id = target_group_id for update;
  if current_revision <> expected_revision then
    raise exception using errcode = '40001', message = 'group_conflict';
  end if;
  if (select count(*) from public.members where group_id = target_group_id) <= 2 then
    raise exception using errcode = '22023', message = 'members_too_short';
  end if;
  if exists (
    select 1 from public.group_memberships where member_id = target_member_id
    union all
    select 1 from public.payments where payer_member_id = target_member_id
    union all
    select 1 from public.payment_participants where member_id = target_member_id
    union all
    select 1 from public.settlement_transfers
      where from_member_id = target_member_id or to_member_id = target_member_id
  ) then
    raise exception using errcode = '22023', message = 'member_in_use';
  end if;

  delete from public.members
  where id = target_member_id and group_id = target_group_id;
  if not found then
    raise exception using errcode = '22023', message = 'member_invalid';
  end if;

  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.rotate_invite(target_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text := private.new_invite_token();
begin
  perform private.assert_group_owner(target_group_id);
  update public.groups
  set invite_token_hash = private.invite_hash(new_token),
      invite_enabled = true,
      revision = revision + 1,
      updated_at = now()
  where id = target_group_id;
  return new_token;
end;
$$;

create or replace function public.set_invite_enabled(
  target_group_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_group_owner(target_group_id);
  update public.groups
  set invite_enabled = enabled,
      revision = revision + 1,
      updated_at = now()
  where id = target_group_id;
end;
$$;

create or replace function public.delete_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_group_owner(target_group_id);
  delete from public.group_memberships where group_id = target_group_id;
  delete from public.groups where id = target_group_id;
end;
$$;

create or replace function public.migrate_local_group(
  group_name text,
  member_names text[],
  self_member_name text,
  records jsonb
)
returns table (group_id uuid, invite_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_group_id uuid;
  created_token text;
  current_user_id uuid := private.assert_authenticated();
  record_value jsonb;
  created_payment_id uuid;
  payer_id uuid;
  beneficiary_ids uuid[];
  amount_value numeric;
begin
  if jsonb_typeof(records) <> 'array' then
    raise exception using errcode = '22023', message = 'records_invalid';
  end if;

  select created.group_id, created.invite_token
  into created_group_id, created_token
  from public.create_group(group_name, member_names, self_member_name) created;

  for record_value in select value from jsonb_array_elements(records)
  loop
    if jsonb_typeof(record_value) <> 'object'
      or jsonb_typeof(record_value -> 'title') <> 'string'
      or jsonb_typeof(record_value -> 'payer') <> 'string'
      or jsonb_typeof(record_value -> 'amount') <> 'number'
      or jsonb_typeof(record_value -> 'for') <> 'array' then
      raise exception using errcode = '22023', message = 'record_invalid';
    end if;

    amount_value := (record_value ->> 'amount')::numeric;
    if amount_value <> trunc(amount_value)
      or amount_value < 0
      or amount_value > 9007199254740991 then
      raise exception using errcode = '22023', message = 'payment_amount_invalid';
    end if;

    select members.id into payer_id
    from public.members
    where members.group_id = created_group_id
      and members.name = btrim(record_value ->> 'payer');

    select array_agg(members.id order by beneficiaries.ordinal)
    into beneficiary_ids
    from jsonb_array_elements_text(record_value -> 'for')
      with ordinality as beneficiaries(name, ordinal)
    join public.members
      on members.group_id = created_group_id
     and members.name = btrim(beneficiaries.name);

    if payer_id is null
      or coalesce(cardinality(beneficiary_ids), 0)
        <> jsonb_array_length(record_value -> 'for') then
      raise exception using errcode = '22023', message = 'record_member_invalid';
    end if;

    perform private.validate_payment_input(
      created_group_id,
      record_value ->> 'title',
      payer_id,
      amount_value::bigint,
      beneficiary_ids
    );

    insert into public.payments (
      group_id, title, payer_member_id, amount,
      created_by_user_id, updated_by_user_id
    ) values (
      created_group_id,
      btrim(record_value ->> 'title'),
      payer_id,
      amount_value::bigint,
      current_user_id,
      current_user_id
    ) returning id into created_payment_id;

    insert into public.payment_participants (
      payment_id, group_id, member_id, position
    )
    select created_payment_id, created_group_id, member_id, ordinal - 1
    from unnest(beneficiary_ids) with ordinality as input(member_id, ordinal);
  end loop;

  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = created_group_id and jsonb_array_length(records) > 0;

  return query select created_group_id, created_token;
end;
$$;

revoke execute on function public.create_group(text, text[], text) from public, anon;
revoke execute on function public.inspect_invite(text) from public, anon;
revoke execute on function public.join_group(text, uuid) from public, anon;
revoke execute on function public.get_group_snapshot(uuid) from public, anon;
revoke execute on function public.create_payment(uuid, text, uuid, bigint, uuid[]) from public, anon;
revoke execute on function public.update_payment(uuid, bigint, text, uuid, bigint, uuid[]) from public, anon;
revoke execute on function public.delete_payment(uuid, bigint) from public, anon;
revoke execute on function public.record_settlement_transfer(uuid, uuid, uuid, bigint, bigint) from public, anon;
revoke execute on function public.delete_settlement_transfer(uuid, bigint) from public, anon;
revoke execute on function public.change_my_member(uuid, uuid) from public, anon;
revoke execute on function public.update_group_name(uuid, text, bigint) from public, anon;
revoke execute on function public.add_member(uuid, text, bigint) from public, anon;
revoke execute on function public.rename_member(uuid, uuid, text, bigint) from public, anon;
revoke execute on function public.delete_member(uuid, uuid, bigint) from public, anon;
revoke execute on function public.rotate_invite(uuid) from public, anon;
revoke execute on function public.set_invite_enabled(uuid, boolean) from public, anon;
revoke execute on function public.delete_group(uuid) from public, anon;
revoke execute on function public.migrate_local_group(text, text[], text, jsonb) from public, anon;

grant execute on function public.create_group(text, text[], text) to authenticated;
grant execute on function public.inspect_invite(text) to authenticated;
grant execute on function public.join_group(text, uuid) to authenticated;
grant execute on function public.get_group_snapshot(uuid) to authenticated;
grant execute on function public.create_payment(uuid, text, uuid, bigint, uuid[]) to authenticated;
grant execute on function public.update_payment(uuid, bigint, text, uuid, bigint, uuid[]) to authenticated;
grant execute on function public.delete_payment(uuid, bigint) to authenticated;
grant execute on function public.record_settlement_transfer(uuid, uuid, uuid, bigint, bigint) to authenticated;
grant execute on function public.delete_settlement_transfer(uuid, bigint) to authenticated;
grant execute on function public.change_my_member(uuid, uuid) to authenticated;
grant execute on function public.update_group_name(uuid, text, bigint) to authenticated;
grant execute on function public.add_member(uuid, text, bigint) to authenticated;
grant execute on function public.rename_member(uuid, uuid, text, bigint) to authenticated;
grant execute on function public.delete_member(uuid, uuid, bigint) to authenticated;
grant execute on function public.rotate_invite(uuid) to authenticated;
grant execute on function public.set_invite_enabled(uuid, boolean) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.migrate_local_group(text, text[], text, jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;
end;
$$;
