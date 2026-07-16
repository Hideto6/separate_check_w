begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

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

reset role;
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
