-- ============================================================================
-- Samudaya · RLS and business-rule test suite
-- ----------------------------------------------------------------------------
-- Two societies, several members each. The suite exists to prove the promises
-- the product makes:
--
--   · a resident sees every approved rupee of spending, with the bill
--   · a resident does not see what their neighbour gave
--   · nobody approves their own expense
--   · a closed ledger stays closed
--   · moving money between funds takes a vote that clears a threshold
--   · one member, one vote
--   · nothing leaks across societies
-- ============================================================================

truncate test.results;

reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'asha@example.com',   '{"full_name":"Asha Menon"}'),
  ('22222222-2222-4222-8222-222222222222', 'bala@example.com',   '{"full_name":"Bala Krishnan"}'),
  ('33333333-3333-4333-8333-333333333333', 'chitra@example.com', '{"full_name":"Chitra Rao"}'),
  ('44444444-4444-4444-8444-444444444444', 'dev@example.com',    '{"full_name":"Dev Sharma"}'),
  ('55555555-5555-4555-8555-555555555555', 'esha@example.com',   '{"full_name":"Esha Patil"}'),
  ('66666666-6666-4666-8666-666666666666', 'farid@example.com',  '{"full_name":"Farid Khan"}'),
  ('77777777-7777-4777-8777-777777777777', 'gita@example.com',   '{"full_name":"Gita Nair"}');

select test.eq((select count(*)::int from public.profiles), 7,
  'signup trigger mirrors every auth user into profiles');

create or replace function test.act_as(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

create or replace function test.act_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  execute 'set role anon';
end $$;

-- ---------------------------------------------------------------------------
-- Two societies
-- ---------------------------------------------------------------------------
-- Societies are set up by the platform team (the service role here), with the
-- first committee member named as created_by.
reset role;
insert into public.communities (id, slug, join_code, name, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'green-valley', 'MHR4827',
   'My Home Residency', '11111111-1111-4111-8111-111111111111');

select test.eq(
  (select role::text from public.memberships
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and user_id = '11111111-1111-4111-8111-111111111111'),
  'committee', 'the named founder joins the society as committee');

select test.act_as('11111111-1111-4111-8111-111111111111');

insert into public.units (id, community_id, block, number) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'A', '101'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'A', '102'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'B', '201');

reset role;
insert into public.communities (id, slug, join_code, name, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'lake-view', 'LKV1234',
   'Lake View Residency', '77777777-7777-4777-8777-777777777777');
select test.act_as('77777777-7777-4777-8777-777777777777');

select test.eq(test.visible('select id from public.communities'), 1::bigint,
  'a committee member sees only their own society');

-- ---------------------------------------------------------------------------
-- Founding a society from the app
-- ---------------------------------------------------------------------------
-- public.communities still has no INSERT policy, so create_society() is the
-- only door in. That is what stops a client naming itself the founder of a
-- society it invented, or of one that already exists.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('88888888-8888-4888-8888-888888888888', 'hana@example.com',   '{"full_name":"Hana Iyer"}'),
  ('b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9', 'ismail@example.com', '{"full_name":"Ismail Rahman"}');

select test.act_as('88888888-8888-4888-8888-888888888888');
select test.raises(
  $q$insert into public.communities (slug, name, created_by)
     values ('hill-crest', 'Hill Crest', '88888888-8888-4888-8888-888888888888')$q$,
  'a signed-in user cannot insert a society directly');

select test.eq(
  (select status from public.create_society('Hill Crest', 'Bengaluru')),
  'ok', 'a signed-in user can found a society through create_society()');
select test.eq(
  (select slug from public.communities where name = 'Hill Crest'),
  'hill-crest', 'the web address is derived from the name');
select test.eq(
  (select role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'hill-crest'
      and m.user_id = '88888888-8888-4888-8888-888888888888'),
  'committee', 'the founder joins their own society as committee');
select test.ok(
  (select count(*) from public.catalogue_items ci
     join public.communities c on c.id = ci.community_id
    where c.slug = 'hill-crest') > 0,
  'a founded society starts with the default catalogue');
select test.eq(test.visible($q$select id from public.communities where slug = 'hill-crest'$q$), 1::bigint,
  'the founder can see the society they just opened');
select test.eq(
  (select created_by from public.communities where slug = 'hill-crest'),
  '88888888-8888-4888-8888-888888888888'::uuid,
  'the founder is recorded from the session, not from the request');
select test.eq((select status from public.create_society('x')), 'invalid_name',
  'a one-character name is refused');

-- Two societies may share a name; they cannot share a web address.
select test.act_as('b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9');
select test.ok(
  (select slug from public.create_society('Hill Crest', 'Pune')) not in ('hill-crest'),
  'a name already taken still gets a free web address of its own');
select test.eq((select status from public.create_society('Ismail Gardens')), 'ok',
  'a second society is fine');
select test.eq((select status from public.create_society('Ismail Heights')), 'ok',
  'and a third');
select test.eq((select status from public.create_society('Ismail Towers')), 'too_many',
  'one account cannot open more than three societies');

-- A founder may undo a society nobody has joined; that is all delete is for.
-- Both statements run as Ismail: RLS silently narrows the second to no rows.
delete from public.communities where slug = 'ismail-heights';
delete from public.communities where slug = 'hill-crest';

reset role;
select test.eq((select count(*) from public.communities where slug = 'ismail-heights'), 0::bigint,
  'the founder can delete a society nobody else is in');
select test.eq((select count(*) from public.communities where slug = 'hill-crest'), 1::bigint,
  'and cannot touch a society somebody else founded');

-- The rest of the suite shares one Society ID for Hill Crest, so pin the
-- generated one to something readable.
reset role;
update public.communities set join_code = 'HILL2026' where slug = 'hill-crest';

-- ---------------------------------------------------------------------------
-- Joining by Society ID, with admin approval
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');

create temporary table t_req as
select * from public.request_to_join(
  'MHR4827', 'bbbbbbbb-0000-4000-8000-000000000001', 'Chitra Rao', '9876543210', 'owner');
grant select on t_req to authenticated;

select test.eq((select status from t_req), 'pending',
  'knowing the Society ID gets you a pending request, not membership');
select test.eq(test.visible('select id from public.memberships'), 0::bigint,
  'a pending request is not membership: the society is still invisible');
select test.eq(
  (select status from public.request_to_join('NOPE99')),
  'not_found', 'a wrong Society ID is refused');

-- Asking again refreshes the same request rather than queueing a second.
select test.eq(
  (select status from public.request_to_join('MHR4827', 'bbbbbbbb-0000-4000-8000-000000000001', 'Chitra Rao')),
  'pending', 'asking twice refreshes the pending request');
reset role;
select test.eq((select count(*)::int from public.join_requests
                 where user_id = '33333333-3333-4333-8333-333333333333'), 1,
  'and does not create a second row for staff to wade through');

-- A resident cannot admit themselves.
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.raises(
  format($q$select public.review_join_request('%s', true)$q$, (select request_id from t_req)),
  'a requester cannot approve their own join request');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.eq(
  (select status::text from public.review_join_request((select request_id from t_req), true, 'resident')),
  'approved', 'the committee admits the request');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.communities'), 1::bigint,
  'approval lets the resident in');
select test.eq(
  (select count(*)::int from public.unit_occupants o
     join public.memberships m on m.id = o.membership_id
    where m.user_id = '33333333-3333-4333-8333-333333333333'),
  1, 'and seats them in the flat they claimed');

-- Bring the rest in directly, as an admin would with a pre-approved code.
reset role;
insert into public.memberships (community_id, user_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'committee', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'resident', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'staff', 'active');

insert into public.unit_occupants (unit_id, membership_id, relation, is_primary)
select 'bbbbbbbb-0000-4000-8000-000000000002', m.id, 'owner', true
  from public.memberships m where m.user_id = '44444444-4444-4444-8444-444444444444';

-- ---------------------------------------------------------------------------
-- An event: draft, then published
-- ---------------------------------------------------------------------------
select test.act_as('11111111-1111-4111-8111-111111111111');

insert into public.events (id, community_id, slug, emoji, name, starts_on, venue, organizer, description, fund_target, fund_rule, fund_rule_note, created_by)
values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'ganesh-2026', '🎉', 'Ganesh Chaturthi 2026', '2026-09-14', 'Clubhouse',
        'Society Cultural Committee', 'Ten days of pooja, performances and community meals.',
        150000, 'carry_next_edition',
        'Any surplus will be carried forward to Ganesh Chaturthi 2027.',
        '11111111-1111-4111-8111-111111111111');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.events'), 0::bigint,
  'a draft event is invisible to residents');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.eq(test.visible('select id from public.events'), 1::bigint,
  'staff can see the draft they are preparing');
select test.raises(
  $q$update public.events set status = 'completed'
      where id = 'cccccccc-0000-4000-8000-000000000001'$q$,
  'staff cannot close an event; that is a committee decision');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
update public.events set status = 'published'
 where id = 'cccccccc-0000-4000-8000-000000000001';
select test.ok(
  (select published_at is not null from public.events
    where id = 'cccccccc-0000-4000-8000-000000000001'),
  'publishing stamps published_at automatically');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.events'), 1::bigint,
  'once published, residents see the event');

-- ---------------------------------------------------------------------------
-- Checklist drives readiness
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
insert into public.event_tasks (event_id, community_id, name, status) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ganesh idol finalized', 'done'),
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Decoration vendor selected', 'done'),
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Sound system booking', 'in_progress'),
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Food vendor confirmation', 'todo');

select test.eq(
  (select readiness from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  50, 'readiness is computed from the checklist, not stored');
select test.ok(
  (select completed_at is not null from public.event_tasks where name = 'Ganesh idol finalized'),
  'completing a task stamps completed_at');

update public.event_tasks set status = 'todo' where name = 'Ganesh idol finalized';
select test.ok(
  (select completed_at is null from public.event_tasks where name = 'Ganesh idol finalized'),
  'reopening a task clears the stamp, so readiness history stays truthful');
update public.event_tasks set status = 'done' where name = 'Ganesh idol finalized';

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.event_tasks'), 4::bigint,
  'residents can watch the checklist');
update public.event_tasks set status = 'done' where name = 'Food vendor confirmation';
reset role;
select test.eq(
  (select status::text from public.event_tasks where name = 'Food vendor confirmation'),
  'todo', 'but cannot tick tasks off themselves');
select test.act_as('33333333-3333-4333-8333-333333333333');

-- ---------------------------------------------------------------------------
-- Contributions: totals public, amounts private
-- ---------------------------------------------------------------------------
insert into public.contributions (event_id, community_id, membership_id, amount, method)
select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'), 5000, 'upi';

reset role;
select test.act_as('44444444-4444-4444-8444-444444444444');
insert into public.contributions (event_id, community_id, membership_id, amount, method)
select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'), 2000, 'card';

select test.eq(test.visible('select id from public.contributions'), 1::bigint,
  'a resident sees only their own contribution, not their neighbour''s');
select test.eq(
  coalesce((select fund_raised from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'), 0),
  0::numeric, 'a reported payment does not count until staff confirm it');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select public.review_contribution(c.id, true) from public.contributions c
 where c.event_id = 'cccccccc-0000-4000-8000-000000000001' and c.status = 'pending';

reset role;
select test.act_as('44444444-4444-4444-8444-444444444444');
select test.eq(
  (select fund_raised from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  7000::numeric(12,2),
  'but the society total is public — that is the whole point of the fund');
select test.eq(
  (select contributors from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  2, 'and so is the number of families who gave');

select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, amount)
     select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
            m.id, 999 from public.memberships m
      where m.user_id = '33333333-3333-4333-8333-333333333333'$q$,
  'a resident cannot record a contribution in somebody else''s name');

update public.contributions set amount = 999999;
reset role;
select test.eq(
  (select sum(amount) from public.contributions
    where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  7000::numeric,
  'and cannot edit a payment record after the fact');
select test.act_as('44444444-4444-4444-8444-444444444444');

-- ---------------------------------------------------------------------------
-- The ledger: approved spending is public, pending is not
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');

insert into public.expenses (id, event_id, community_id, name, category, amount, vendor, bill_url, requested_by)
select 'dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
       'aaaaaaaa-0000-4000-8000-000000000001', 'Decoration', 'decoration', 25000,
       'ABC Decorations', 'bills/abc-decorations.pdf',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

select test.raises(
  $q$insert into public.expenses (event_id, community_id, name, amount, status, requested_by)
     select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
            'Sneaky', 1000, 'approved',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')$q$,
  'an expense cannot be filed pre-approved');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.expenses'), 0::bigint,
  'a resident does not see an expense that is still under review');
select test.eq(
  (select spent from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  0::numeric(12,2),
  'and unapproved spending is not counted as spent');

-- The requester must not be able to sign off their own claim.
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-000000000001', 'approved')$q$,
  'staff cannot approve a bill at all');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
insert into public.expenses (id, event_id, community_id, name, amount, vendor, requested_by)
select 'dddddddd-0000-4000-8000-000000000009', 'cccccccc-0000-4000-8000-000000000001',
       'aaaaaaaa-0000-4000-8000-000000000001', 'Own claim', 4000, 'Self',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-000000000009', 'approved')$q$,
  'a committee member cannot approve a bill they raised themselves');

select test.eq(
  (select status::text from public.review_expense('dddddddd-0000-4000-8000-000000000001', 'approved')),
  'approved', 'the committee approves somebody else''s bill');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.expenses'), 1::bigint,
  'the moment it is approved, every resident can see it');
select test.eq(
  (select vendor from public.expenses where id = 'dddddddd-0000-4000-8000-000000000001'),
  'ABC Decorations', 'including which vendor was paid');
select test.ok(
  (select bill_url is not null from public.expenses
    where id = 'dddddddd-0000-4000-8000-000000000001'),
  'and the bill itself');
select test.eq(
  (select spent from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  25000::numeric(12,2), 'approved spending counts towards the total');
select test.eq(
  (select available from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  (7000 - 25000)::numeric(12,2),
  'available is raised minus spent, even when that goes negative');

update public.expenses set status = 'approved'
 where id = 'dddddddd-0000-4000-8000-000000000009';
reset role;
select test.eq(
  (select status::text from public.expenses where id = 'dddddddd-0000-4000-8000-000000000009'),
  'pending', 'a resident cannot approve an expense with a direct update');
select test.act_as('33333333-3333-4333-8333-333333333333');

-- ---------------------------------------------------------------------------
-- Activities and volunteering
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
insert into public.event_activities (id, event_id, community_id, name, emoji, description)
values ('eeeeeeee-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001', 'Dance', '💃', 'Group dance for all ages.');

insert into public.volunteer_roles (id, event_id, community_id, name, emoji, target_count)
values ('ffffffff-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001', 'Decoration', '🎈', 3);

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
insert into public.activity_participants (activity_id, membership_id, performance_type, age_group)
select 'eeeeeeee-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'), 'Group', 'Adult';

select test.eq(
  (select interested from public.activity_stats where activity_id = 'eeeeeeee-0000-4000-8000-000000000001'),
  1, 'joining an activity is counted');

select test.raises(
  $q$insert into public.activity_participants (activity_id, membership_id)
     select 'eeeeeeee-0000-4000-8000-000000000001',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')$q$,
  'signing up twice is a double tap, not a second performer');

insert into public.event_volunteers (role_id, membership_id)
select 'ffffffff-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

select test.eq(
  (select still_needed from public.volunteer_role_stats where role_id = 'ffffffff-0000-4000-8000-000000000001'),
  2, '"2 more needed" is computed from the target, never counted down by hand');

select test.eq(
  (select participants from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  1, 'event participation reflects activity sign-ups');

-- ---------------------------------------------------------------------------
-- Polls: one member, one vote; ballots secret
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
insert into public.polls (id, community_id, question)
values ('a1a1a1a1-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'Should we organize a children''s drawing competition?');
insert into public.poll_options (id, poll_id, label, emoji, position) values
  ('a2a2a2a2-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'Yes', '👍', 0),
  ('a2a2a2a2-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'No',  '👎', 1);

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
insert into public.poll_votes (poll_id, option_id, membership_id)
select 'a1a1a1a1-0000-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

select test.raises(
  $q$insert into public.poll_votes (poll_id, option_id, membership_id)
     select 'a1a1a1a1-0000-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000002',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')$q$,
  'a member cannot vote twice in the same poll');

reset role;
select test.act_as('44444444-4444-4444-8444-444444444444');
insert into public.poll_votes (poll_id, option_id, membership_id)
select 'a1a1a1a1-0000-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000002',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

select test.eq(test.visible('select id from public.poll_votes'), 1::bigint,
  'a ballot is secret: you see your own vote and nobody else''s');
select test.eq(
  (select votes from public.poll_results where option_id = 'a2a2a2a2-0000-4000-8000-000000000001'),
  1, 'but the tally is public');
select test.eq(
  (select total_votes from public.poll_results where option_id = 'a2a2a2a2-0000-4000-8000-000000000001'),
  2, 'and so is the turnout');

-- ---------------------------------------------------------------------------
-- Fund reallocation needs a vote that clears the threshold
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
insert into public.events (id, community_id, slug, name, starts_on, status, fund_target, created_by)
values ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
        'sports-day-2026', 'Society Sports Day', '2026-10-05', 'published', 60000,
        '11111111-1111-4111-8111-111111111111');

insert into public.fund_reallocations
  (id, community_id, from_event_id, to_event_id, amount, reason, threshold_pct)
values ('b1b1b1b1-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000002',
        15000, 'Use surplus funds to support children''s sports activities.', 60);

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.raises(
  $q$insert into public.fund_reallocations
       (community_id, from_event_id, to_label, amount, reason)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             'cccccccc-0000-4000-8000-000000000001', 'General fund', 1000, 'because')$q$,
  'staff may not propose moving money between funds');

-- Five active members, so 60% needs three approvals.
reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(
  (select resolved from public.vote_on_reallocation('b1b1b1b1-0000-4000-8000-000000000001', true)),
  false, 'one vote does not carry a proposal');

reset role;
select test.act_as('44444444-4444-4444-8444-444444444444');
select test.eq(
  (select resolved from public.vote_on_reallocation('b1b1b1b1-0000-4000-8000-000000000001', true)),
  false, 'nor does two');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(
  (select approve_votes from public.vote_on_reallocation('b1b1b1b1-0000-4000-8000-000000000001', true)),
  2, 'voting again changes your vote rather than adding one');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
create temporary table t_vote as
select * from public.vote_on_reallocation('b1b1b1b1-0000-4000-8000-000000000001', true);
grant select on t_vote to authenticated;

select test.eq((select resolved from t_vote), true,
  'the third of five approvals clears the 60% threshold');
select test.eq((select approved from t_vote), true, 'and the proposal passes');

reset role;
select test.eq(
  (select status::text from public.fund_reallocations where id = 'b1b1b1b1-0000-4000-8000-000000000001'),
  'approved', 'the proposal is recorded as approved');
select test.eq(
  (select count(*)::int from public.audit_logs
    where action = 'fund_reallocation.approved'
      and entity_id = 'b1b1b1b1-0000-4000-8000-000000000001'),
  1, 'and an audit row is written in the same transaction as the deciding vote');

select test.act_as('11111111-1111-4111-8111-111111111111');
select test.eq(
  (select status from public.vote_on_reallocation('b1b1b1b1-0000-4000-8000-000000000001', false)),
  'already_resolved', 'votes cast after it resolves change nothing');

-- ---------------------------------------------------------------------------
-- Closing an event freezes its ledger
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
update public.events set status = 'completed'
 where id = 'cccccccc-0000-4000-8000-000000000001';
select test.ok(
  (select closed_at is not null from public.events where id = 'cccccccc-0000-4000-8000-000000000001'),
  'closing an event stamps closed_at');

-- Bala did not raise this bill, so only the closed ledger can stop him.
reset role;
select test.act_as('22222222-2222-4222-8222-222222222222');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-000000000009', 'approved')$q$,
  'a closed event''s ledger cannot take new approvals');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.raises(
  $q$update public.events set status = 'published'
      where id = 'cccccccc-0000-4000-8000-000000000001'$q$,
  'and a closed event cannot be reopened');

-- ---------------------------------------------------------------------------
-- Nothing leaks across societies
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(test.visible('select id from public.events'), 0::bigint,
  'a member of another society sees none of these events');
select test.eq(test.visible('select * from public.event_stats'), 0::bigint,
  'nor any of their numbers');
select test.eq(test.visible('select id from public.expenses'), 0::bigint,
  'nor a single line of their ledger');
select test.eq(test.visible('select id from public.contributions'), 0::bigint,
  'nor who contributed');
select test.eq(test.visible('select * from public.poll_results'), 0::bigint,
  'nor their poll results');
select test.eq(test.visible('select id from public.memberships'), 1::bigint,
  'membership rows do not leak across societies');

reset role;
select test.act_as('66666666-6666-4666-8666-666666666666');
select test.eq(test.visible('select id from public.communities'), 0::bigint,
  'someone with no membership sees no societies at all');
select test.eq(test.visible('select id from public.events'), 0::bigint,
  'and no events');
select test.eq(test.visible('select id from public.profiles'), 1::bigint,
  'and only their own profile');

reset role;
select test.act_anon();
select test.eq(test.visible('select id from public.events'), 0::bigint,
  'anonymous callers see nothing');
select test.eq(test.visible('select * from public.event_stats'), 0::bigint,
  'not even aggregate numbers');

-- ---------------------------------------------------------------------------
-- Three roles in Hill Crest: Hana (committee), Sam (staff), Ria and Tom
-- (residents of the same flat), Neil (resident waiting to be admitted)
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('99999999-9999-4999-8999-999999999999', 'sam@example.com',  '{"full_name":"Sam Supervisor"}'),
  ('abababab-abab-4bab-8bab-abababababab', 'ria@example.com',  '{"full_name":"Ria Menon"}'),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd', 'tom@example.com',  '{"full_name":"Tom Menon"}'),
  ('efefefef-efef-4fef-8fef-efefefefefef', 'neil@example.com', '{"full_name":"Neil Das"}');
insert into public.units (id, community_id, block, number)
select 'b2b2b2b2-0000-4000-8000-000000000001', c.id, 'A', '1104' from public.communities c where c.slug = 'hill-crest';
insert into public.memberships (community_id, user_id, role, status)
select c.id, u.id::uuid, u.role::public.member_role, 'active'
  from public.communities c,
       (values ('99999999-9999-4999-8999-999999999999', 'staff'),
               ('abababab-abab-4bab-8bab-abababababab', 'resident'),
               ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd', 'resident')) as u(id, role)
 where c.slug = 'hill-crest';
insert into public.events (id, community_id, slug, name, starts_on, status, fund_target)
select 'cccccccc-0000-4000-8000-0000000000aa', c.id, 'hill-diwali', 'Hill Crest Diwali', '2026-11-07', 'published', 50000
  from public.communities c where c.slug = 'hill-crest';
insert into public.event_activities (id, event_id, community_id, name)
select 'eeeeeeee-0000-4000-8000-0000000000aa', 'cccccccc-0000-4000-8000-0000000000aa', c.id, 'Rangoli'
  from public.communities c where c.slug = 'hill-crest';

-- Joining with the one society code; staff admit.
select test.act_as('efefefef-efef-4fef-8fef-efefefefefef');
select test.eq((select count(*) from public.society_units('HILL2026')), 1::bigint,
  'someone with the society code can pick from its flats before joining');
select test.eq((select count(*) from public.society_units('WRONG1')), 0::bigint,
  'a wrong code shows no flats');
select test.eq(test.visible('select id from public.units'), 0::bigint,
  'and flats stay hidden from non-members otherwise');
create temporary table t_neil as
select * from public.request_to_join('HILL2026', 'b2b2b2b2-0000-4000-8000-000000000001', 'Neil Das', '9845012345', 'tenant');
grant select on t_neil to authenticated;
select test.eq((select status from t_neil), 'pending', 'a new resident submits the society code and their details');
select test.eq(test.visible($q$select id from public.events where slug = 'hill-diwali'$q$), 0::bigint,
  'and sees nothing until admitted');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  format($q$select public.review_join_request('%s', true, 'staff')$q$, (select request_id from t_neil)),
  'staff cannot admit someone as staff');
select test.eq(
  (select status::text from public.review_join_request((select request_id from t_neil), true)),
  'approved', 'staff admit a new resident');

reset role;
select test.act_as('efefefef-efef-4fef-8fef-efefefefefef');
select test.eq(test.visible($q$select id from public.events where slug = 'hill-diwali'$q$), 1::bigint,
  'once admitted, the resident sees events');

-- Staff remove residents, but never committee or other staff.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
delete from public.memberships where user_id = 'efefefef-efef-4fef-8fef-efefefefefef';
select test.eq(
  (select count(*)::int from public.memberships where user_id = 'efefefef-efef-4fef-8fef-efefefefefef'),
  0, 'staff remove a resident');
delete from public.memberships where user_id = '88888888-8888-4888-8888-888888888888';
reset role;
select test.eq(
  (select count(*)::int from public.memberships where user_id = '88888888-8888-4888-8888-888888888888'),
  1, 'but cannot remove a committee member');
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$update public.memberships set role = 'staff'
      where user_id = 'abababab-abab-4bab-8bab-abababababab'$q$,
  'and cannot change anyone''s role');

-- Money: residents contribute, staff do not; staff see and record every flat.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.contributions (event_id, community_id, membership_id, unit_id, amount)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 'b2b2b2b2-0000-4000-8000-000000000001', 2001
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, amount)
     select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 500
       from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999'$q$,
  'staff cannot contribute as a participant');
insert into public.contributions (event_id, community_id, unit_id, amount, method, channel, status)
select 'cccccccc-0000-4000-8000-0000000000aa', e.community_id, 'b2b2b2b2-0000-4000-8000-000000000001', 1500, 'cash', 'system', 'succeeded'
  from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
select test.eq(test.visible($q$select id from public.contributions where event_id = 'cccccccc-0000-4000-8000-0000000000aa'$q$),
  2::bigint, 'staff record cash against a flat and see every flat''s payments');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from public.contributions where event_id = 'cccccccc-0000-4000-8000-0000000000aa'$q$),
  0::bigint, 'a resident does not see other people''s payments');

-- Bills: staff raise them, only committee decides.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.expenses (id, event_id, community_id, name, category, amount, vendor, requested_by)
select 'dddddddd-0000-4000-8000-0000000000aa', 'cccccccc-0000-4000-8000-0000000000aa', m.community_id,
       'Diyas', 'decoration', 2500, 'Clay Crafts', m.id
  from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999';
update public.expenses set amount = 2400, bill_url = 'bills/diyas-corrected.pdf'
 where id = 'dddddddd-0000-4000-8000-0000000000aa';
select test.eq((select amount from public.expenses where id = 'dddddddd-0000-4000-8000-0000000000aa'),
  2400::numeric(12,2), 'staff correct a pending bill and re-upload it');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-0000000000aa', 'approved')$q$,
  'staff cannot approve a bill');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select status::text from public.review_expense('dddddddd-0000-4000-8000-0000000000aa', 'approved')),
  'approved', 'the committee approves it');

-- Budget: staff plan it, residents read it.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.budget_lines (event_id, community_id, category, amount)
select 'cccccccc-0000-4000-8000-0000000000aa', e.community_id, 'Decoration', 12000
  from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(test.visible('select id from public.budget_lines'), 1::bigint, 'residents see the budget');
select test.raises(
  $q$insert into public.budget_lines (event_id, community_id, category, amount)
     select 'cccccccc-0000-4000-8000-0000000000aa', e.community_id, 'Sweets', 5000
       from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa'$q$,
  'but cannot change it');

-- Several people from one flat register for an activity.
insert into public.activity_participants (activity_id, membership_id, participant_name)
select 'eeeeeeee-0000-4000-8000-0000000000aa', m.id, n
  from public.memberships m, (values ('Ria Menon'), ('Aarav Menon')) v(n)
 where m.user_id = 'abababab-abab-4bab-8bab-abababababab';
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.activity_participants (activity_id, membership_id)
select 'eeeeeeee-0000-4000-8000-0000000000aa', m.id
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
reset role;
select test.eq(
  (select count(*)::int from public.activity_participants where activity_id = 'eeeeeeee-0000-4000-8000-0000000000aa'),
  3, 'two family members and a flatmate from the same flat all register');

-- Campaigns: a resident proposes, only the committee approves.
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.events (id, community_id, slug, name, starts_on, kind, status, fund_target, created_by)
select 'cccccccc-0000-4000-8000-0000000000bb', c.id, 'park-benches', 'New benches for the park', '2026-12-01',
       'campaign', 'proposed', 40000, 'abababab-abab-4bab-8bab-abababababab'
  from public.communities c where c.slug = 'hill-crest';
select test.eq(test.visible($q$select id from public.events where slug = 'park-benches'$q$), 1::bigint,
  'a resident proposes a fundraising campaign and sees it');
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from public.events where slug = 'park-benches'$q$), 0::bigint,
  'other residents do not see it until approved');
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$update public.events set status = 'published' where slug = 'park-benches'$q$,
  'staff cannot approve a campaign');
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
update public.events set status = 'published' where slug = 'park-benches';
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from public.events where slug = 'park-benches'$q$), 1::bigint,
  'once the committee approves, every resident sees it');

-- Suggestions: residents suggest, committee opens voting, one vote each.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.activity_suggestions (id, community_id, event_id, kind, name, suggested_by)
select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.community_id, 'cccccccc-0000-4000-8000-0000000000aa', 'activity',
       'Lantern walk', m.id
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';
select test.raises(
  $q$insert into public.suggestion_votes (suggestion_id, membership_id, support)
     select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, true
       from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab'$q$,
  'nobody votes on a suggestion before the committee approves it');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$update public.activity_suggestions set status = 'accepted'
      where id = 'f1f1f1f1-0000-4000-8000-0000000000aa'$q$,
  'staff cannot approve a suggestion');
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
update public.activity_suggestions set status = 'accepted' where id = 'f1f1f1f1-0000-4000-8000-0000000000aa';

reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.suggestion_votes (suggestion_id, membership_id, support)
select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, true
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.suggestion_votes (suggestion_id, membership_id, support)
select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, false
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
select test.raises(
  $q$insert into public.suggestion_votes (suggestion_id, membership_id, support)
     select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, true
       from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$,
  'one vote per person, even from the same flat');
reset role;
select test.eq((select count(*)::int from public.suggestion_votes where suggestion_id = 'f1f1f1f1-0000-4000-8000-0000000000aa'),
  2, 'two people in the same flat each get a vote');
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$insert into public.suggestion_votes (suggestion_id, membership_id, support)
     select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, true
       from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999'$q$,
  'staff do not vote');

-- ---------------------------------------------------------------------------
-- UPI payments: report, then staff confirm
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
update public.communities set upi_vpa = 'hillcrest.rwa@okaxis', upi_payee_name = 'Hill Crest RWA'
 where slug = 'hill-crest';
select test.eq((select upi_vpa from public.communities where slug = 'hill-crest'),
  'hillcrest.rwa@okaxis', 'the committee sets the society''s UPI ID');
select test.raises(
  $q$update public.communities set upi_vpa = 'not a vpa' where slug = 'hill-crest'$q$,
  'an invalid UPI ID is refused');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
update public.communities set upi_vpa = 'staff.personal@okicici' where slug = 'hill-crest';
reset role;
select test.eq((select upi_vpa from public.communities where slug = 'hill-crest'),
  'hillcrest.rwa@okaxis', 'staff cannot redirect payments to another UPI ID');

select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, amount, method, reference, status)
     select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 1001, 'upi', '612345678901', 'succeeded'
       from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$,
  'a resident cannot mark their own payment as confirmed');
insert into public.contributions (event_id, community_id, membership_id, amount, method, reference)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 1001, 'upi', '612345678901'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
select test.eq(
  (select status::text from public.contributions where reference = '612345678901'),
  'pending', 'a resident reports a UPI payment with its reference');
select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, amount, method, reference)
     select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 1001, 'upi', ' 612345678901'
       from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$,
  'the same UPI reference cannot be reported twice');

-- Look the id up as the platform, so the resident below really calls the
-- function instead of RLS hiding the row and skipping the call.
reset role;
create temporary table t_upi as
select id from public.contributions where reference = '612345678901';
grant select on t_upi to authenticated;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.raises(
  format($q$select public.review_contribution('%s', true)$q$, (select id from t_upi)),
  'a resident cannot confirm a payment');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$select public.review_contribution(c.id, false) from public.contributions c where c.reference = '612345678901'$q$,
  'turning a payment down needs a reason');
select test.eq(
  (select status::text from public.review_contribution(
     (select c.id from public.contributions c where c.reference = '612345678901'), true)),
  'succeeded', 'staff confirm it against the bank statement');
select test.raises(
  $q$select public.review_contribution(c.id, false, 'duplicate') from public.contributions c where c.reference = '612345678901'$q$,
  'and a confirmed payment cannot be reviewed again');

-- ---------------------------------------------------------------------------
-- Storage: bills and payment screenshots
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into storage.objects (bucket_id, name)
select 'bills', c.id || '/cccccccc-0000-4000-8000-0000000000aa/lanterns.pdf'
  from public.communities c where c.slug = 'hill-crest';
insert into public.expenses (id, event_id, community_id, name, category, amount, vendor, requested_by, bill_url)
select 'dddddddd-0000-4000-8000-0000000000bb', 'cccccccc-0000-4000-8000-0000000000aa', m.community_id,
       'Lanterns', 'decoration', 1800, 'Paper Glow', m.id, m.community_id || '/cccccccc-0000-4000-8000-0000000000aa/lanterns.pdf'
  from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999';
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'bills'$q$), 1::bigint,
  'staff upload a bill and can read it');

reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.raises(
  $q$insert into storage.objects (bucket_id, name)
     select 'bills', c.id || '/cccccccc-0000-4000-8000-0000000000aa/fake.pdf'
       from public.communities c where c.slug = 'hill-crest'$q$,
  'a resident cannot upload bills');
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'bills'$q$), 0::bigint,
  'a resident cannot open a bill that is still pending');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select public.review_expense('dddddddd-0000-4000-8000-0000000000bb', 'approved');

reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'bills'$q$), 1::bigint,
  'once approved, residents can open the bill');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
delete from storage.objects where bucket_id = 'bills';
reset role;
select test.eq((select count(*)::int from storage.objects where bucket_id = 'bills'), 1,
  'nobody can delete an approved bill''s file');

select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into storage.objects (bucket_id, name)
select 'payment-proofs', m.community_id || '/' || m.id || '/utr.png'
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';
select test.raises(
  $q$insert into storage.objects (bucket_id, name)
     select 'payment-proofs', m.community_id || '/' || m.id || '/not-mine.png'
       from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$,
  'a resident cannot upload into someone else''s payment folder');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'payment-proofs'$q$), 0::bigint,
  'a flatmate cannot see another person''s payment screenshot');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'payment-proofs'$q$), 1::bigint,
  'staff can see it to confirm the payment');

-- ---------------------------------------------------------------------------
-- Catalogue, flats and first-run welcome
-- ---------------------------------------------------------------------------
reset role;
select test.ok(
  (select count(*) from public.catalogue_items i join public.communities c on c.id = i.community_id
    where c.slug = 'hill-crest' and i.kind = 'budget_category') >= 10,
  'a new society starts with a default catalogue');

select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.ok(
  test.visible($q$select id from public.catalogue_items where kind = 'venue'$q$) > 0,
  'residents can read the catalogue to pick from it');
select test.raises(
  $q$insert into public.catalogue_items (community_id, kind, label)
     select c.id, 'vendor', 'Resident Vendor' from public.communities c where c.slug = 'hill-crest'$q$,
  'but cannot change it');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.catalogue_items (community_id, kind, label, details)
select c.id, 'vendor', 'Shubh Tent House', '{"phone":"+919845000111"}'
  from public.communities c where c.slug = 'hill-crest';
select test.eq(test.visible($q$select id from public.catalogue_items where label = 'Shubh Tent House'$q$),
  1::bigint, 'staff add a vendor to the catalogue');
select test.raises(
  $q$insert into public.catalogue_items (community_id, kind, label)
     select c.id, 'vendor', ' shubh tent house ' from public.communities c where c.slug = 'hill-crest'$q$,
  'the same label cannot be added twice in a different case');
select test.raises(
  $q$insert into public.units (community_id, block, number)
     select c.id, 'Z', '999' from public.communities c where c.slug = 'hill-crest'$q$,
  'staff cannot add flats; the committee sets them up');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(test.visible($q$select i.id from public.catalogue_items i join public.communities c on c.id = i.community_id where c.slug = 'hill-crest'$q$),
  0::bigint, 'another society''s catalogue stays private');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
insert into public.units (community_id, block, number, floor)
select c.id, 'B', '201', 2 from public.communities c where c.slug = 'hill-crest';
select test.eq(test.visible($q$select id from public.units where block = 'B' and number = '201'$q$),
  1::bigint, 'the committee adds flats during setup');

reset role;
update public.memberships set welcomed_at = null where user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select public.mark_welcomed(c.id) from public.communities c where c.slug = 'hill-crest';
reset role;
select test.ok(
  (select welcomed_at is not null from public.memberships where user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'),
  'a member marks their own welcome as seen');
update public.memberships set welcomed_at = null where user_id = 'abababab-abab-4bab-8bab-abababababab';
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select public.mark_welcomed(c.id) from public.communities c where c.slug = 'hill-crest';
reset role;
select test.ok(
  (select welcomed_at is null from public.memberships where user_id = 'abababab-abab-4bab-8bab-abababababab'),
  'and nobody else''s');

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
reset role;
truncate public.notifications;
insert into auth.users (id, email, raw_user_meta_data) values
  ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'omar@example.com', '{"full_name":"Omar Sheikh"}');

select test.act_as('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0');
create temporary table t_omar as
select * from public.request_to_join('HILL2026', 'b2b2b2b2-0000-4000-8000-000000000001', 'Omar Sheikh', '9845098450', 'tenant');
grant select on t_omar to authenticated;

reset role;
select test.eq(
  (select array_agg(m.role::text order by m.role::text) from public.notifications n
     join public.memberships m on m.user_id = n.user_id
     join public.communities c on c.id = m.community_id and c.slug = 'hill-crest'
    where n.kind = 'join_request'),
  array['committee', 'staff'], 'a join request notifies staff and committee, not residents');

select test.act_as('99999999-9999-4999-8999-999999999999');
select public.review_join_request((select request_id from t_omar), true);
reset role;
select test.eq(
  (select count(*)::int from public.notifications
    where kind = 'join_approved' and user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'),
  1, 'the new resident is told they are in');

select test.act_as('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0');
insert into public.contributions (event_id, community_id, membership_id, unit_id, amount, method, reference)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 'b2b2b2b2-0000-4000-8000-000000000001', 501, 'upi', '698765432109'
  from public.memberships m where m.user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0';
select test.eq(test.visible($q$select id from public.notifications where kind = 'payment_reported'$q$), 0::bigint,
  'the payer is not notified about their own report');

reset role;
select test.eq((select count(*)::int from public.notifications where kind = 'payment_reported'), 2,
  'staff and committee are asked to confirm it');

select test.act_as('99999999-9999-4999-8999-999999999999');
select public.review_contribution(c.id, true) from public.contributions c where c.reference = '698765432109';
select public.mark_notifications_read();
reset role;
select test.eq(
  (select count(*)::int from public.notifications
    where kind = 'payment_confirmed' and user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'),
  1, 'and the payer hears when it is confirmed');
select test.ok(
  (select bool_and(read_at is not null) from public.notifications where user_id = '99999999-9999-4999-8999-999999999999')
  and (select bool_and(read_at is null) from public.notifications where user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'),
  'marking all read only touches the caller''s own notifications');

select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from public.notifications where kind = 'payment_confirmed'$q$), 0::bigint,
  'nobody reads another member''s notifications');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select contributors from public.event_stats where event_id = 'cccccccc-0000-4000-8000-0000000000aa'),
  2, 'contributors count households: two confirmed payments for flat A-1104 (staff cash and Omar) plus Tom''s count as two');

-- ---------------------------------------------------------------------------
-- To do queue
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', 'priya@example.com', '{"full_name":"Priya Das"}');
select test.act_as('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0');
select public.request_to_join('HILL2026', null, 'Priya Das', '9845011111', 'other');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.contributions (event_id, community_id, membership_id, amount, method, reference)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 750, 'upi', '677700011122'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
insert into public.activity_suggestions (community_id, event_id, kind, name, suggested_by)
select m.community_id, 'cccccccc-0000-4000-8000-0000000000aa', 'idea', 'Glow sticks for kids', m.id
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.expenses (event_id, community_id, name, category, amount, vendor, requested_by)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, 'Sweets', 'Food & catering', 3200, 'Anand Sweets', m.id
  from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999';
select test.eq(
  (select array_agg(distinct kind order by kind) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  array['join_request', 'payment_to_confirm'],
  'staff see join requests and payments to confirm, not approvals that need the committee');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select array_agg(distinct kind order by kind) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  array['bill_to_approve', 'join_request', 'payment_to_confirm', 'suggestion_to_review'],
  'the committee also sees bills, campaigns and suggestions to decide');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(
  (select count(*) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  0::bigint, 'residents have no admin to do list');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(
  (select count(*) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  0::bigint, 'another society''s committee sees nothing');

reset role;

-- ---------------------------------------------------------------------------
-- todo_count() is the badge: it must always agree with todo_items()
-- ---------------------------------------------------------------------------
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'hill-crest'))::bigint,
  (select count(*) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  'staff badge count matches their To do list');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'hill-crest'))::bigint,
  (select count(*) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  'committee badge count matches their To do list');
select test.ok(
  public.todo_count((select id from public.communities where slug = 'hill-crest')) > 0,
  'the committee badge is not trivially zero');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'hill-crest')),
  0, 'residents have no badge');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'hill-crest')),
  0, 'another society''s committee gets no count');

reset role;

-- ---------------------------------------------------------------------------
-- A society people actually live in cannot be deleted
-- ---------------------------------------------------------------------------
-- Founding from the app needs an undo for the society opened by mistake. It
-- must not become a way to cascade away a live ledger, so the guard closes the
-- moment anyone else is in.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.raises(
  $q$delete from public.communities where slug = 'hill-crest'$q$,
  'even the founder cannot delete a society once others have joined');
select test.eq(
  (select count(*) from public.communities where slug = 'hill-crest'),
  1::bigint, 'and the society is still there');

reset role;

-- ---------------------------------------------------------------------------
-- One person, two societies, two different roles
-- ---------------------------------------------------------------------------
-- The committee member who founded Hill Crest also rents a flat in Green
-- Valley. Role is a property of the membership, not of the person, so every
-- permission has to resolve per society and never leak from the stronger one.
reset role;
insert into public.units (id, community_id, block, number)
select 'b3b3b3b3-0000-4000-8000-000000000001', c.id, 'C', '302'
  from public.communities c where c.slug = 'green-valley';
insert into public.memberships (community_id, user_id, role, status)
select c.id, '88888888-8888-4888-8888-888888888888', 'resident', 'active'
  from public.communities c where c.slug = 'green-valley';

select test.act_as('88888888-8888-4888-8888-888888888888');

select test.eq(test.visible('select id from public.communities'), 2::bigint,
  'one account can belong to two societies at once');
select test.eq(
  (select m.role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'hill-crest' and m.user_id = '88888888-8888-4888-8888-888888888888'),
  'committee', 'committee in the society they founded');
select test.eq(
  (select m.role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'green-valley' and m.user_id = '88888888-8888-4888-8888-888888888888'),
  'resident', 'and a plain resident in the other');

-- todo_count is role-sensitive, so it reads the two memberships apart.
select test.ok(
  public.todo_count((select id from public.communities where slug = 'hill-crest')) > 0,
  'their committee queue in one society is not empty');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'green-valley')),
  0, 'and being committee elsewhere earns them no queue here');

-- Promoting someone is a committee act. Being committee in Hill Crest must buy
-- nothing in Green Valley: RLS narrows the statement to no rows, so it reports
-- success and changes nothing rather than raising.
update public.memberships m
   set role = 'staff'
  from public.communities c
 where c.id = m.community_id and c.slug = 'green-valley'
   and m.user_id = '44444444-4444-4444-8444-444444444444';

reset role;
select test.eq(
  (select m.role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'green-valley'
      and m.user_id = '44444444-4444-4444-8444-444444444444'),
  'resident', 'committee in one society changes no roles in another');
