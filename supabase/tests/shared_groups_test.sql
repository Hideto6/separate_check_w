begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

insert into auth.users (id, aud, role, is_anonymous)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', true),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', true),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select set_config('test.group_id', created.group_id::text, false),
       set_config('test.invite_token', created.invite_token, false)
from public.create_group('テスト旅行', array['A', 'B'], 'A') created;

select is(
  (select count(*) from public.groups),
  1::bigint,
  'owner can create one group'
);

select is(
  public.inspect_invite(current_setting('test.invite_token')) ->> 'groupName',
  'テスト旅行',
  'valid invite can be inspected'
);

select throws_ok(
  $$select public.inspect_invite('invalid-token')$$,
  '22023',
  'invite_invalid',
  'invalid invite is rejected'
);

select set_config(
  'test.member_b',
  (select id::text from public.members where name = 'B'),
  false
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select is(
  public.join_group(
    current_setting('test.invite_token'),
    current_setting('test.member_b')::uuid
  ),
  current_setting('test.group_id')::uuid,
  'editor joins with a valid invite'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select is(
  (select count(*) from public.groups),
  0::bigint,
  'non-member cannot read a group through RLS'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select set_config(
  'test.member_a',
  (select id::text from public.members where name = 'A'),
  false
);
select set_config(
  'test.payment_id',
  public.create_payment(
    current_setting('test.group_id')::uuid,
    'ホテル',
    current_setting('test.member_a')::uuid,
    1000,
    array[
      current_setting('test.member_a')::uuid,
      current_setting('test.member_b')::uuid
    ]
  )::text,
  false
);
select is(
  (select count(*) from public.payments),
  1::bigint,
  'editor can add a payment'
);

select set_config(
  'test.revision_before_idempotent_payment',
  (
    select revision::text
    from public.groups
    where id = current_setting('test.group_id')::uuid
  ),
  false
);
select set_config(
  'test.payment_operation_id',
  '10000000-0000-0000-0000-000000000001',
  false
);
select set_config(
  'test.idempotent_payment_id',
  public.create_payment_idempotent(
    current_setting('test.group_id')::uuid,
    current_setting('test.payment_operation_id')::uuid,
    '  電車  ',
    current_setting('test.member_a')::uuid,
    1500,
    array[
      current_setting('test.member_b')::uuid,
      current_setting('test.member_a')::uuid
    ]
  )::text,
  false
);
select is(
  (
    select count(*)
    from public.payments
    where id = current_setting('test.idempotent_payment_id')::uuid
  ),
  1::bigint,
  'idempotent payment creation creates one payment'
);
select is(
  (
    select title
    from public.payments
    where id = current_setting('test.idempotent_payment_id')::uuid
  ),
  '電車',
  'idempotent payment creation normalizes the title'
);
select is(
  (
    select jsonb_agg(participants.member_id order by participants.position)
    from public.payment_participants participants
    where participants.payment_id =
      current_setting('test.idempotent_payment_id')::uuid
  ),
  to_jsonb(array[
    current_setting('test.member_b')::uuid,
    current_setting('test.member_a')::uuid
  ]),
  'idempotent payment creation preserves beneficiary order'
);
select is(
  public.create_payment_idempotent(
    current_setting('test.group_id')::uuid,
    current_setting('test.payment_operation_id')::uuid,
    '電車',
    current_setting('test.member_a')::uuid,
    1500,
    array[
      current_setting('test.member_b')::uuid,
      current_setting('test.member_a')::uuid
    ]
  ),
  current_setting('test.idempotent_payment_id')::uuid,
  'an exact retry returns the original payment id'
);
select is(
  (
    select revision
    from public.groups
    where id = current_setting('test.group_id')::uuid
  ),
  current_setting('test.revision_before_idempotent_payment')::bigint + 1,
  'an exact retry increments the group revision only once'
);
select throws_ok(
  $$select public.create_payment_idempotent(
      current_setting('test.group_id')::uuid,
      current_setting('test.payment_operation_id')::uuid,
      '電車',
      current_setting('test.member_a')::uuid,
      1501,
      array[
        current_setting('test.member_b')::uuid,
        current_setting('test.member_a')::uuid
      ]
    )$$,
  '40001',
  'payment_operation_conflict',
  'reusing an operation id with a changed payload is rejected'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select set_config(
  'test.owner_idempotent_payment_id',
  public.create_payment_idempotent(
    current_setting('test.group_id')::uuid,
    current_setting('test.payment_operation_id')::uuid,
    '電車',
    current_setting('test.member_a')::uuid,
    1500,
    array[
      current_setting('test.member_b')::uuid,
      current_setting('test.member_a')::uuid
    ]
  )::text,
  false
);
select isnt(
  current_setting('test.owner_idempotent_payment_id')::uuid,
  current_setting('test.idempotent_payment_id')::uuid,
  'another authenticated member can independently reuse an operation id'
);
select is(
  (
    select count(*)
    from public.payments
    where id = current_setting('test.owner_idempotent_payment_id')::uuid
  ),
  1::bigint,
  'another member operation creates its own payment'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select throws_ok(
  $$select public.create_payment_idempotent(
      current_setting('test.group_id')::uuid,
      current_setting('test.payment_operation_id')::uuid,
      '電車',
      current_setting('test.member_a')::uuid,
      1500,
      array[current_setting('test.member_a')::uuid]
    )$$,
  '42501',
  'group_membership_required',
  'a non-member cannot create an idempotent payment'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select lives_ok(
  $$select public.delete_payment(
      current_setting('test.idempotent_payment_id')::uuid,
      1
    )$$,
  'an idempotently created payment can be deleted'
);
select set_config(
  'test.revision_after_idempotent_payment_delete',
  (
    select revision::text
    from public.groups
    where id = current_setting('test.group_id')::uuid
  ),
  false
);
select is(
  public.create_payment_idempotent(
    current_setting('test.group_id')::uuid,
    current_setting('test.payment_operation_id')::uuid,
    '電車',
    current_setting('test.member_a')::uuid,
    1500,
    array[
      current_setting('test.member_b')::uuid,
      current_setting('test.member_a')::uuid
    ]
  ),
  current_setting('test.idempotent_payment_id')::uuid,
  'retrying after payment deletion still returns the original id'
);
select is(
  (
    select count(*)
    from public.payments
    where id = current_setting('test.idempotent_payment_id')::uuid
  ),
  0::bigint,
  'retrying after payment deletion does not recreate the payment'
);
select is(
  (
    select revision
    from public.groups
    where id = current_setting('test.group_id')::uuid
  ),
  current_setting('test.revision_after_idempotent_payment_delete')::bigint,
  'retrying after payment deletion does not increment the revision'
);

select throws_ok(
  $$select public.set_invite_enabled(
      current_setting('test.group_id')::uuid,
      false
    )$$,
  '42501',
  'group_owner_required',
  'editor cannot update owner settings'
);

select throws_ok(
  $$select public.update_payment(
      current_setting('test.payment_id')::uuid,
      99,
      '競合',
      current_setting('test.member_a')::uuid,
      1000,
      array[current_setting('test.member_a')::uuid]
    )$$,
  '40001',
  'payment_conflict',
  'stale payment version is rejected'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select lives_ok(
  $$select public.set_invite_enabled(
      current_setting('test.group_id')::uuid,
      false
    )$$,
  'owner can stop an invite'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select throws_ok(
  $$select public.inspect_invite(current_setting('test.invite_token'))$$,
  '22023',
  'invite_invalid',
  'disabled invite is rejected'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select set_config('test.deleted_group_id', created.group_id::text, false)
from public.create_group('削除テスト', array['X', 'Y'], 'X') created;
select set_config(
  'test.deleted_group_member_x',
  (
    select id::text
    from public.members
    where group_id = current_setting('test.deleted_group_id')::uuid
      and name = 'X'
  ),
  false
);
select set_config(
  'test.deleted_group_operation_id',
  '10000000-0000-0000-0000-000000000099',
  false
);
select set_config(
  'test.deleted_group_payment_id',
  public.create_payment_idempotent(
    current_setting('test.deleted_group_id')::uuid,
    current_setting('test.deleted_group_operation_id')::uuid,
    '削除前の支払い',
    current_setting('test.deleted_group_member_x')::uuid,
    500,
    array[current_setting('test.deleted_group_member_x')::uuid]
  )::text,
  false
);
select lives_ok(
  $$select public.delete_group(
      current_setting('test.deleted_group_id')::uuid
    )$$,
  'owner can delete a group containing a creation receipt'
);
select throws_ok(
  $$select public.create_payment_idempotent(
      current_setting('test.deleted_group_id')::uuid,
      current_setting('test.deleted_group_operation_id')::uuid,
      '削除前の支払い',
      current_setting('test.deleted_group_member_x')::uuid,
      500,
      array[current_setting('test.deleted_group_member_x')::uuid]
    )$$,
  '42501',
  'group_membership_required',
  'retrying after group deletion is rejected'
);

reset role;
select is(
  (
    select count(*)
    from private.payment_creation_receipts receipts
    where receipts.group_id = current_setting('test.deleted_group_id')::uuid
  ),
  0::bigint,
  'group deletion removes its creation receipts'
);
select is(
  (
    select count(*)
    from private.payment_creation_receipts receipts
    where receipts.actor_user_id =
        '00000000-0000-0000-0000-000000000002'::uuid
      and receipts.operation_id =
        current_setting('test.payment_operation_id')::uuid
      and receipts.payment_id =
        current_setting('test.idempotent_payment_id')::uuid
  ),
  1::bigint,
  'the creation receipt survives payment deletion'
);
select is(
  (
    select receipts.payload -> 'beneficiaryMemberIds'
    from private.payment_creation_receipts receipts
    where receipts.actor_user_id =
        '00000000-0000-0000-0000-000000000002'::uuid
      and receipts.operation_id =
        current_setting('test.payment_operation_id')::uuid
  ),
  to_jsonb(array[
    current_setting('test.member_b')::uuid,
    current_setting('test.member_a')::uuid
  ]),
  'the creation receipt payload preserves beneficiary order'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated users cannot access the private schema directly'
);
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anonymous users cannot access the private schema directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.payment_creation_receipts',
    'SELECT'
  ),
  'authenticated users cannot select creation receipts directly'
);
select ok(
  not has_table_privilege(
    'anon',
    'private.payment_creation_receipts',
    'SELECT'
  ),
  'anonymous users cannot select creation receipts directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_payment_idempotent(uuid,uuid,text,uuid,bigint,uuid[])',
    'EXECUTE'
  ),
  'anonymous users cannot execute the idempotent payment RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_payment_idempotent(uuid,uuid,text,uuid,bigint,uuid[])',
    'EXECUTE'
  ),
  'authenticated users can execute the idempotent payment RPC'
);
select is(
  (select count(*) from public.groups),
  1::bigint,
  'owner settings do not delete the group'
);

select is(
  to_regprocedure('public.add_member(uuid,text,bigint)'),
  null::regprocedure,
  'member addition RPC is removed'
);

select is(
  to_regprocedure('public.rename_member(uuid,uuid,text,bigint)'),
  null::regprocedure,
  'member rename RPC is removed'
);

select is(
  to_regprocedure('public.delete_member(uuid,uuid,bigint)'),
  null::regprocedure,
  'member deletion RPC is removed'
);

select ok(
  to_regprocedure('public.change_my_member(uuid,uuid)') is not null,
  'member identity change RPC remains available'
);

select is(
  to_regprocedure('public.update_group_name(uuid,text,bigint)'),
  null::regprocedure,
  'group name update RPC is removed'
);

select is(
  to_regprocedure('public.migrate_local_group(text,text[],text,jsonb)'),
  null::regprocedure,
  'legacy local migration RPC is removed'
);

select * from finish();
rollback;
