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
select test.act_as('11111111-1111-4111-8111-111111111111');

insert into public.communities (id, slug, join_code, name, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'green-valley', 'MHR4827',
   'My Home Residency', '11111111-1111-4111-8111-111111111111');

select test.eq(
  (select role::text from public.memberships
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and user_id = '11111111-1111-4111-8111-111111111111'),
  'owner', 'the founder becomes owner of the society they create');

insert into public.units (id, community_id, block, number) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'A', '101'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'A', '102'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'B', '201');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
insert into public.communities (id, slug, join_code, name, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'lake-view', 'LKV1234',
   'Lake View Residency', '77777777-7777-4777-8777-777777777777');

select test.eq(test.visible('select id from public.communities'), 1::bigint,
  'an owner sees only their own society');

-- ---------------------------------------------------------------------------
-- Founding a society the way the web app does
-- ---------------------------------------------------------------------------
-- The founder becomes a member in an after-insert trigger, which runs after
-- RETURNING has already been checked against the members-only SELECT policy.
-- So `insert ... returning` (supabase-js `.insert().select()`) is rejected, and
-- onboarding must insert first and read the society back separately. Hana is a
-- fresh user so nothing below depends on her.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('88888888-8888-4888-8888-888888888888', 'hana@example.com', '{"full_name":"Hana Iyer"}');

select test.act_as('88888888-8888-4888-8888-888888888888');
select test.raises(
  $q$insert into public.communities (slug, name, created_by)
     values ('hill-crest', 'Hill Crest', '88888888-8888-4888-8888-888888888888')
     returning slug$q$,
  'a founder cannot read a new society back in the same insert');

insert into public.communities (slug, name, created_by)
  values ('hill-crest', 'Hill Crest', '88888888-8888-4888-8888-888888888888');
select test.eq(test.visible($q$select id from public.communities where slug = 'hill-crest'$q$), 1::bigint,
  'a plain insert succeeds and the founder can read the society straight after');
select test.eq(
  (select role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'hill-crest' and m.user_id = '88888888-8888-4888-8888-888888888888'),
  'owner', 'and is its owner');

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
  'and does not create a second row for the admin to wade through');

-- A resident cannot admit themselves.
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.raises(
  format($q$select public.review_join_request('%s', true)$q$, (select request_id from t_req)),
  'a requester cannot approve their own join request');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.eq(
  (select status::text from public.review_join_request((select request_id from t_req), true, 'resident')),
  'approved', 'an admin approves the request');

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
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'admin', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'resident', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'committee', 'active');

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
  'the committee can see the draft they are preparing');
select test.raises(
  $q$update public.events set status = 'published'
      where id = 'cccccccc-0000-4000-8000-000000000001'$q$,
  'a committee member cannot publish an event to the whole society');

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
  'a committee member cannot approve an expense at all');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
insert into public.expenses (id, event_id, community_id, name, amount, vendor, requested_by)
select 'dddddddd-0000-4000-8000-000000000009', 'cccccccc-0000-4000-8000-000000000001',
       'aaaaaaaa-0000-4000-8000-000000000001', 'Own claim', 4000, 'Self',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-000000000009', 'approved')$q$,
  'an admin cannot approve an expense they requested themselves');

select test.eq(
  (select status::text from public.review_expense('dddddddd-0000-4000-8000-000000000001', 'approved')),
  'approved', 'an admin approves somebody else''s expense');

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
  'only an admin may propose moving money between funds');

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

select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-000000000009', 'approved')$q$,
  'a closed event''s ledger cannot take new approvals');

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

reset role;
