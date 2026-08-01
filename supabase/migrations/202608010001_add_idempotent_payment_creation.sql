create table private.payment_creation_receipts (
  actor_user_id uuid not null
    references auth.users(id) on delete cascade,
  operation_id uuid not null,
  group_id uuid not null
    references public.groups(id) on delete cascade,
  payment_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, operation_id)
);

create index payment_creation_receipts_group_id_idx
  on private.payment_creation_receipts(group_id);

alter table private.payment_creation_receipts enable row level security;

revoke all on table private.payment_creation_receipts
  from public, anon, authenticated;

create or replace function public.create_payment_idempotent(
  target_group_id uuid,
  operation_id uuid,
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
  current_user_id uuid := private.assert_authenticated();
  client_operation_id uuid := operation_id;
  normalized_payment_title text := btrim(payment_title);
  operation_payload jsonb;
  created_payment_id uuid := extensions.gen_random_uuid();
  existing_group_id uuid;
  existing_payment_id uuid;
  existing_payload jsonb;
begin
  if client_operation_id is null then
    raise exception using
      errcode = '22023',
      message = 'payment_operation_id_invalid';
  end if;

  operation_payload := jsonb_build_object(
    'title', normalized_payment_title,
    'payerMemberId', payer_id,
    'amount', payment_amount,
    'beneficiaryMemberIds', to_jsonb(beneficiary_ids)
  );

  select
    receipts.group_id,
    receipts.payment_id,
    receipts.payload
  into
    existing_group_id,
    existing_payment_id,
    existing_payload
  from private.payment_creation_receipts receipts
  where receipts.actor_user_id = current_user_id
    and receipts.operation_id = client_operation_id;

  if existing_payment_id is not null
    and (
      existing_group_id is distinct from target_group_id
      or existing_payload is distinct from operation_payload
    ) then
    raise exception using
      errcode = '40001',
      message = 'payment_operation_conflict';
  end if;

  perform private.assert_group_member(target_group_id);
  perform private.validate_payment_input(
    target_group_id,
    normalized_payment_title,
    payer_id,
    payment_amount,
    beneficiary_ids
  );

  if existing_payment_id is not null then
    return existing_payment_id;
  end if;

  insert into private.payment_creation_receipts (
    actor_user_id,
    operation_id,
    group_id,
    payment_id,
    payload
  ) values (
    current_user_id,
    client_operation_id,
    target_group_id,
    created_payment_id,
    operation_payload
  )
  on conflict on constraint payment_creation_receipts_pkey do nothing
  returning payment_id into existing_payment_id;

  if existing_payment_id is null then
    select
      receipts.group_id,
      receipts.payment_id,
      receipts.payload
    into
      existing_group_id,
      existing_payment_id,
      existing_payload
    from private.payment_creation_receipts receipts
    where receipts.actor_user_id = current_user_id
      and receipts.operation_id = client_operation_id;

    if existing_group_id is distinct from target_group_id
      or existing_payload is distinct from operation_payload then
      raise exception using
        errcode = '40001',
        message = 'payment_operation_conflict';
    end if;

    return existing_payment_id;
  end if;

  insert into public.payments (
    id,
    group_id,
    title,
    payer_member_id,
    amount,
    created_by_user_id,
    updated_by_user_id
  ) values (
    created_payment_id,
    target_group_id,
    normalized_payment_title,
    payer_id,
    payment_amount,
    current_user_id,
    current_user_id
  );

  insert into public.payment_participants (
    payment_id,
    group_id,
    member_id,
    position
  )
  select created_payment_id, target_group_id, member_id, ordinal - 1
  from unnest(beneficiary_ids) with ordinality as input(member_id, ordinal);

  update public.groups
  set revision = revision + 1, updated_at = now()
  where id = target_group_id;

  return created_payment_id;
end;
$$;

revoke execute on function public.create_payment_idempotent(
  uuid,
  uuid,
  text,
  uuid,
  bigint,
  uuid[]
) from public, anon;

grant execute on function public.create_payment_idempotent(
  uuid,
  uuid,
  text,
  uuid,
  bigint,
  uuid[]
) to authenticated;
