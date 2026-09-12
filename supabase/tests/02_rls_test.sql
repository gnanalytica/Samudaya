-- ============================================================================
-- Samudaya · RLS and business-rule test suite
-- ----------------------------------------------------------------------------
-- Two communities, several members each. The point is to prove that a member
-- of one community cannot observe or touch the other, that invite codes behave
-- at their edges, and that the escalation guards hold.
-- ============================================================================

truncate test.results;

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser: this is the "signup" half that Supabase Auth does)
-- ---------------------------------------------------------------------------
reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'asha@example.com',  '{"full_name":"Asha Owner"}'),
  ('22222222-2222-2222-2222-222222222222', 'bala@example.com',  '{"full_name":"Bala Admin"}'),
  ('33333333-3333-3333-3333-333333333333', 'chitra@example.com','{"full_name":"Chitra Resident"}'),
  ('44444444-4444-4444-4444-444444444444', 'dev@example.com',   '{"full_name":"Dev Resident"}'),
  ('55555555-5555-5555-5555-555555555555', 'esha@example.com',  '{"full_name":"Esha Gate"}'),
  ('66666666-6666-6666-6666-666666666666', 'farid@example.com', '{"full_name":"Farid Outsider"}'),
  ('77777777-7777-7777-7777-777777777777', 'gita@example.com',  '{"full_name":"Gita OtherOwner"}');

select test.eq(
  (select count(*)::int from public.profiles), 7,
  'signup trigger mirrors every auth user into profiles'
);
select test.eq(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Asha Owner',
  'profile picks up full_name from auth metadata'
);

-- Helper to act as a given user through PostgREST-equivalent settings.
create or replace function test.act_as(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_uid, 'role', 'authenticated')::text,
                     false);
  execute 'set role authenticated';
end $$;

create or replace function test.act_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  execute 'set role anon';
end $$;

-- ---------------------------------------------------------------------------
-- Asha founds "Green Valley"; Gita founds "Lake View"
-- ---------------------------------------------------------------------------
select test.act_as('11111111-1111-1111-1111-111111111111');

insert into public.communities (id, slug, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'green-valley', 'Green Valley Apartments',
   '11111111-1111-1111-1111-111111111111');

select test.eq(
  (select role::text from public.memberships
    where community_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '11111111-1111-1111-1111-111111111111'),
  'owner',
  'founder is seeded as owner of the community they create'
);

insert into public.units (id, community_id, block, number, monthly_dues) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A', '101', 3500),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'A', '102', 3500),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'B', '201', 4200);

select test.raises(
  $q$insert into public.units (community_id, block, number)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '101')$q$,
  'a unit label cannot repeat inside one community'
);

reset role;
select test.act_as('77777777-7777-7777-7777-777777777777');
insert into public.communities (id, slug, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'lake-view', 'Lake View Residency',
   '77777777-7777-7777-7777-777777777777');
insert into public.units (id, community_id, number) values
  ('bbbbbbbb-0000-0000-0000-000000000099', 'aaaaaaaa-0000-0000-0000-000000000002', '900');

-- ---------------------------------------------------------------------------
-- Tenant isolation
-- ---------------------------------------------------------------------------
select test.eq(test.visible('select id from public.communities'), 1::bigint,
  'an owner sees only their own community');
select test.eq(test.visible('select id from public.units'), 1::bigint,
  'unit visibility is scoped to the caller''s community');

reset role;
select test.act_as('66666666-6666-6666-6666-666666666666');
select test.eq(test.visible('select id from public.communities'), 0::bigint,
  'a user with no membership sees no communities');
select test.eq(test.visible('select id from public.units'), 0::bigint,
  'a user with no membership sees no units');
select test.eq(test.visible('select id from public.profiles'), 1::bigint,
  'a user with no community sees only their own profile');

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('11111111-1111-1111-1111-111111111111');

-- A resident-level, unit-bound, single-use code.
create temporary table t_codes (kind text, code text);
insert into t_codes
select 'resident', (public.create_invite_code(
  'aaaaaaaa-0000-0000-0000-000000000001', 'resident',
  'bbbbbbbb-0000-0000-0000-000000000001', 'owner', 1, null, 'Flat A-101')).code;
insert into t_codes
select 'admin', (public.create_invite_code(
  'aaaaaaaa-0000-0000-0000-000000000001', 'admin', null, 'other', 5, null, 'Managing committee')).code;
insert into t_codes
select 'gate', (public.create_invite_code(
  'aaaaaaaa-0000-0000-0000-000000000001', 'security', null, 'other', 10, null, 'Gate staff')).code;
insert into t_codes
select 'expired', (public.create_invite_code(
  'aaaaaaaa-0000-0000-0000-000000000001', 'resident', null, 'owner', 5,
  now() - interval '1 day', 'Already expired')).code;
insert into t_codes
select 'revoked', (public.create_invite_code(
  'aaaaaaaa-0000-0000-0000-000000000001', 'resident', null, 'owner', 5, null, 'To be revoked')).code;

select test.ok(
  (select bool_and(code ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$') from t_codes),
  'generated codes avoid visually ambiguous characters'
);

select test.raises(
  format($q$select public.create_invite_code('%s', 'owner')$q$,
         'aaaaaaaa-0000-0000-0000-000000000001'),
  'owner access cannot be handed out via an invite code'
);

select test.raises(
  format($q$select public.create_invite_code('%s', 'resident', '%s')$q$,
         'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000099'),
  'an invite code cannot point at a unit in another community'
);

update public.invite_codes set revoked_at = now()
 where code = (select code from t_codes where kind = 'revoked');

-- A non-admin must not be able to mint codes.
reset role;
select test.act_as('66666666-6666-6666-6666-666666666666');
select test.raises(
  format($q$select public.create_invite_code('%s', 'resident')$q$,
         'aaaaaaaa-0000-0000-0000-000000000001'),
  'a non-admin cannot mint invite codes'
);
select test.eq(test.visible('select id from public.invite_codes'), 0::bigint,
  'raw invite codes are never readable by non-admins');

-- Chitra redeems the unit-bound code.
reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
create temporary table t_redeem as
select * from public.redeem_invite_code((select code from t_codes where kind = 'resident'));

select test.eq((select status from t_redeem), 'ok', 'a valid code is redeemed');
select test.eq((select role::text from t_redeem), 'resident', 'the code grants the role it carries');
select test.eq((select community_id from t_redeem), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'redemption attaches the member to the right community');
select test.eq(
  (select count(*)::int from public.unit_occupants o
     join public.memberships m on m.id = o.membership_id
    where m.user_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'a unit-bound code also seats the resident in that flat'
);
select test.ok(
  (select is_primary from public.unit_occupants o
     join public.memberships m on m.id = o.membership_id
    where m.user_id = '33333333-3333-3333-3333-333333333333'),
  'the first occupant of a unit becomes its primary contact'
);

-- Codes are case- and separator-insensitive.
select test.eq(
  (select status from public.redeem_invite_code(
     lower(regexp_replace((select code from t_codes where kind = 'resident'), '(....)(....)', '\1-\2')))),
  'already_member',
  'a code is accepted lowercased and hyphenated, and redemption is idempotent'
);

-- That code was single-use, so Dev cannot reuse it.
reset role;
select test.act_as('44444444-4444-4444-4444-444444444444');
select test.eq(
  (select status from public.redeem_invite_code((select code from t_codes where kind = 'resident'))),
  'exhausted',
  'a single-use code cannot be redeemed twice'
);
select test.eq(
  (select status from public.redeem_invite_code((select code from t_codes where kind = 'expired'))),
  'expired',
  'an expired code is refused'
);
select test.eq(
  (select status from public.redeem_invite_code((select code from t_codes where kind = 'revoked'))),
  'revoked',
  'a revoked code is refused'
);
select test.eq(
  (select status from public.redeem_invite_code('ZZZZZZZZ')),
  'not_found',
  'an unknown code is refused'
);

-- Brute force is throttled after 10 failures in 15 minutes.
do $$
declare i integer;
begin
  for i in 1..8 loop
    perform public.redeem_invite_code('QQQQ' || lpad(i::text, 4, '2'));
  end loop;
end $$;
select test.eq(
  (select status from public.redeem_invite_code('MMMMMMMM')),
  'rate_limited',
  'repeated wrong codes are rate limited'
);

-- Dev joins properly with the multi-use admin code.
-- Clear Dev's throttle as superuser: `authenticated` has no DELETE policy on
-- invite_code_attempts, so doing this in-role would silently delete nothing.
reset role;
delete from public.invite_code_attempts where user_id = '44444444-4444-4444-4444-444444444444';
select test.act_as('44444444-4444-4444-4444-444444444444');
select test.eq(
  (select status from public.redeem_invite_code((select code from t_codes where kind = 'admin'))),
  'ok',
  'a multi-use code admits a second member'
);

-- Esha joins as gate staff.
reset role;
select test.act_as('55555555-5555-5555-5555-555555555555');
select test.eq(
  (select status from public.redeem_invite_code((select code from t_codes where kind = 'gate'))),
  'ok',
  'gate staff join with a security-role code'
);

-- ---------------------------------------------------------------------------
-- Escalation guards
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
-- An UPDATE filtered out by RLS is not an error -- it simply matches no rows --
-- so the assertion has to be about the resulting state, not about an exception.
update public.memberships set role = 'admin'
 where user_id = '33333333-3333-3333-3333-333333333333';
select test.eq(
  (select role::text from public.memberships
    where user_id = '33333333-3333-3333-3333-333333333333'),
  'resident',
  'a resident cannot promote themselves'
);
-- This one DOES raise: the row is visible to its owner, so the policy lets the
-- update through and the guard trigger rejects it.
select test.raises(
  $q$update public.profiles set is_platform_admin = true
      where id = '33333333-3333-3333-3333-333333333333'$q$,
  'a user cannot make themselves a platform admin'
);
select test.ok(
  not (select is_platform_admin from public.profiles
        where id = '33333333-3333-3333-3333-333333333333'),
  'the platform admin flag is still false afterwards'
);

-- Dev is an admin; even so they must not mint an owner or unseat one.
reset role;
select test.act_as('44444444-4444-4444-4444-444444444444');
select test.raises(
  $q$update public.memberships set role = 'owner'
      where user_id = '44444444-4444-4444-4444-444444444444'$q$,
  'an admin cannot promote themselves to owner'
);
select test.raises(
  $q$update public.memberships set role = 'resident'
      where user_id = '11111111-1111-1111-1111-111111111111'$q$,
  'an admin cannot demote the community owner'
);

reset role;
select test.act_as('11111111-1111-1111-1111-111111111111');
select test.raises(
  $q$delete from public.memberships
      where user_id = '11111111-1111-1111-1111-111111111111'$q$,
  'the last owner cannot leave the community'
);

-- An admin may still do ordinary admin things.
select test.ok(
  (select count(*) from public.memberships
    where community_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 4,
  'the community now has owner, admin, resident and gate staff'
);

-- ---------------------------------------------------------------------------
-- Announcements honour their audience
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('11111111-1111-1111-1111-111111111111');
insert into public.announcements (community_id, author_id, title, body, audience)
values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   app.my_membership_id('aaaaaaaa-0000-0000-0000-000000000001'),
   'Water tank cleaning', 'Supply off 10am-2pm on Saturday.', 'all'),
  ('aaaaaaaa-0000-0000-0000-000000000001',
   app.my_membership_id('aaaaaaaa-0000-0000-0000-000000000001'),
   'Committee budget review', 'Internal discussion.', 'committee'),
  ('aaaaaaaa-0000-0000-0000-000000000001',
   app.my_membership_id('aaaaaaaa-0000-0000-0000-000000000001'),
   'Expired notice', 'Old news.', 'all');

update public.announcements
   set published_at = now() - interval '2 days', expires_at = now() - interval '1 day'
 where title = 'Expired notice';

reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
select test.eq(test.visible('select id from public.announcements'), 1::bigint,
  'a resident sees the all-hands notice but not the committee one, nor expired ones');

reset role;
select test.act_as('44444444-4444-4444-4444-444444444444');
select test.eq(test.visible('select id from public.announcements'), 3::bigint,
  'an admin sees every notice, including committee-only and expired ones, so the admin console can manage them');
select test.eq(
  test.visible($q$select id from public.announcements
                  where (expires_at is null or expires_at > now())$q$),
  2::bigint,
  'filtering the admin view by date yields the live notices'
);

reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
select test.raises(
  $q$insert into public.announcements (community_id, title, body)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Spam', 'Buy my thing')$q$,
  'a resident cannot post an announcement'
);

-- ---------------------------------------------------------------------------
-- Service requests
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
insert into public.service_requests (community_id, unit_id, raised_by, category, title, description)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        app.my_membership_id('aaaaaaaa-0000-0000-0000-000000000001'),
        'plumbing', 'Leaking tap in kitchen', 'Dripping since Monday.');

select test.eq(test.visible('select id from public.service_requests'), 1::bigint,
  'a resident sees the ticket they raised');

-- Esha is gate staff, not committee: she must not see maintenance tickets.
reset role;
select test.act_as('55555555-5555-5555-5555-555555555555');
select test.eq(test.visible('select id from public.service_requests'), 0::bigint,
  'gate staff do not get to read residents'' maintenance tickets');

-- Admin works the ticket and leaves an internal note.
reset role;
select test.act_as('44444444-4444-4444-4444-444444444444');
select test.eq(test.visible('select id from public.service_requests'), 1::bigint,
  'an admin sees tickets across the community');

update public.service_requests set status = 'in_progress'
 where title = 'Leaking tap in kitchen';

insert into public.service_request_comments (request_id, author_id, body, is_internal)
select r.id, app.my_membership_id(r.community_id), 'Plumber booked for Thursday.', false
  from public.service_requests r where r.title = 'Leaking tap in kitchen';
insert into public.service_request_comments (request_id, author_id, body, is_internal)
select r.id, app.my_membership_id(r.community_id), 'Charge this to the society budget.', true
  from public.service_requests r where r.title = 'Leaking tap in kitchen';

update public.service_requests set status = 'resolved'
 where title = 'Leaking tap in kitchen';
select test.ok(
  (select resolved_at is not null from public.service_requests
    where title = 'Leaking tap in kitchen'),
  'resolving a ticket stamps resolved_at automatically'
);

reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
select test.eq(test.visible('select id from public.service_request_comments'), 1::bigint,
  'a resident sees public replies but never internal staff notes');
select test.raises(
  $q$insert into public.service_request_comments (request_id, author_id, body, is_internal)
     select r.id, app.my_membership_id(r.community_id), 'sneaky', true
       from public.service_requests r limit 1$q$,
  'a resident cannot write an internal note'
);

-- Cross-tenant probe: Gita must not see Green Valley's ticket even by id.
reset role;
select test.act_as('77777777-7777-7777-7777-777777777777');
select test.eq(test.visible('select id from public.service_requests'), 0::bigint,
  'a member of another community sees none of these tickets');
select test.eq(test.visible('select id from public.announcements'), 0::bigint,
  'a member of another community sees none of these announcements');
select test.eq(test.visible('select id from public.memberships'), 1::bigint,
  'membership rows do not leak across communities');

-- ---------------------------------------------------------------------------
-- Amenities: the database refuses a double booking
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('11111111-1111-1111-1111-111111111111');
insert into public.amenities (id, community_id, name, slot_minutes)
values ('cccccccc-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Clubhouse', 60);

reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
insert into public.amenity_bookings
  (amenity_id, community_id, membership_id, starts_at, ends_at, status)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        app.my_membership_id('aaaaaaaa-0000-0000-0000-000000000001'),
        '2026-10-01 10:00+05:30', '2026-10-01 12:00+05:30', 'confirmed');

reset role;
select test.act_as('44444444-4444-4444-4444-444444444444');
select test.raises(
  $q$insert into public.amenity_bookings
       (amenity_id, community_id, membership_id, starts_at, ends_at, status)
     values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
             app.my_membership_id('aaaaaaaa-0000-0000-0000-000000000001'),
             '2026-10-01 11:00+05:30', '2026-10-01 13:00+05:30', 'confirmed')$q$,
  'an overlapping booking for the same amenity is rejected'
);

-- Back-to-back slots are fine: the range is half-open.
insert into public.amenity_bookings
  (amenity_id, community_id, membership_id, starts_at, ends_at, status)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        app.my_membership_id('aaaaaaaa-0000-0000-0000-000000000001'),
        '2026-10-01 12:00+05:30', '2026-10-01 13:00+05:30', 'confirmed');
select test.eq(test.visible('select id from public.amenity_bookings'), 2::bigint,
  'a booking starting exactly when another ends is allowed');

-- ---------------------------------------------------------------------------
-- Visitor passes
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
insert into public.visitor_passes
  (community_id, unit_id, created_by, visitor_name, kind, expected_at, valid_until)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        app.my_membership_id('aaaaaaaa-0000-0000-0000-000000000001'),
        'Ravi Kumar', 'guest', now(), now() + interval '6 hours');

select test.ok(
  (select pass_code ~ '^[0-9]{6}$' from public.visitor_passes where visitor_name = 'Ravi Kumar'),
  'a six-digit gate code is generated automatically'
);

reset role;
create temporary table t_pass as
  select id from public.visitor_passes where visitor_name = 'Ravi Kumar';
-- Created while unprivileged, so the impersonated role must be let in.
grant select on t_pass to authenticated;

-- Gate staff can see expected visitors so they can verify at the gate.
select test.act_as('55555555-5555-5555-5555-555555555555');
select test.eq(test.visible('select id from public.visitor_passes'), 1::bigint,
  'gate staff see expected visitors');
insert into public.visitor_events (pass_id, community_id, status, recorded_by)
select p.id, p.community_id, 'arrived', app.my_membership_id(p.community_id)
  from public.visitor_passes p where p.visitor_name = 'Ravi Kumar';
select test.eq(test.visible('select id from public.visitor_events'), 1::bigint,
  'gate staff record an arrival');

-- A resident of the same community who is not the host sees nothing.
reset role;
select test.act_as('44444444-4444-4444-4444-444444444444');
update public.memberships set role = 'resident'
 where user_id = '44444444-4444-4444-4444-444444444444';
reset role;
select test.act_as('44444444-4444-4444-4444-444444444444');
select test.eq(test.visible('select id from public.visitor_passes'), 0::bigint,
  'a neighbour cannot see who is visiting another flat');
-- Hand the id over directly: an `insert ... select` would read through Dev's
-- own (empty) view of visitor_passes and insert nothing, which is not a test.
select test.raises(
  format(
    $q$insert into public.visitor_events (pass_id, community_id, status)
       values (%L, %L, 'departed')$q$,
    (select id from t_pass), 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  'a resident cannot forge a gate event'
);

-- ---------------------------------------------------------------------------
-- Billing rollups
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('11111111-1111-1111-1111-111111111111');
insert into public.invoices (id, community_id, unit_id, status, due_date)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 'issued', current_date + 10);
insert into public.invoice_items (invoice_id, description, quantity, unit_price) values
  ('dddddddd-0000-0000-0000-000000000001', 'Maintenance – October', 1, 3500),
  ('dddddddd-0000-0000-0000-000000000001', 'Clubhouse booking', 2, 250);

select test.eq(
  (select total from public.invoices where id = 'dddddddd-0000-0000-0000-000000000001'),
  4000::numeric(12,2),
  'invoice total rolls up from its line items'
);

insert into public.payments (community_id, invoice_id, unit_id, amount, method, status)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 1500, 'upi', 'succeeded');

select test.eq(
  (select status::text from public.invoices where id = 'dddddddd-0000-0000-0000-000000000001'),
  'partly_paid',
  'a partial payment moves the invoice to partly_paid'
);
select test.eq(
  (select balance_due from public.invoices where id = 'dddddddd-0000-0000-0000-000000000001'),
  2500::numeric(12,2),
  'balance_due tracks payments'
);

insert into public.payments (community_id, invoice_id, unit_id, amount, method, status)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 2500, 'upi', 'succeeded');
select test.eq(
  (select status::text from public.invoices where id = 'dddddddd-0000-0000-0000-000000000001'),
  'paid',
  'settling the balance marks the invoice paid'
);

-- Chitra lives in A-101, so she sees that bill. Dev does not.
reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
select test.eq(test.visible('select id from public.invoices'), 1::bigint,
  'a resident sees the invoice for their own flat');

reset role;
select test.act_as('44444444-4444-4444-4444-444444444444');
select test.eq(test.visible('select id from public.invoices'), 0::bigint,
  'a resident cannot see another flat''s invoice');

-- A draft invoice is invisible to the resident until it is issued.
reset role;
select test.act_as('11111111-1111-1111-1111-111111111111');
insert into public.invoices (community_id, unit_id, status)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'draft');
reset role;
select test.act_as('33333333-3333-3333-3333-333333333333');
select test.eq(test.visible('select id from public.invoices'), 1::bigint,
  'draft invoices stay hidden from residents');

-- ---------------------------------------------------------------------------
-- API keys never expose their hash
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('11111111-1111-1111-1111-111111111111');
insert into public.api_keys (id, community_id, name, key_prefix, scopes)
values ('eeeeeeee-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Ops bot', 'sk_live_abc123',
        '{announcements:read,requests:write}');

-- The secret half is written by the server with the service role, never by the
-- admin's own session.
reset role;
insert into public.api_key_secrets (api_key_id, key_hash)
values ('eeeeeeee-0000-0000-0000-000000000001',
        encode(extensions.digest('the-real-key', 'sha256'), 'hex'));

select test.act_as('11111111-1111-1111-1111-111111111111');
select test.eq(test.visible('select id, name from public.api_keys'), 1::bigint,
  'an admin can list their community''s API keys');
select test.raises(
  $q$select key_hash from public.api_key_secrets$q$,
  'the API key hash is unreachable, even for the admin who owns the key'
);

-- Verification itself is service-role only.
select test.raises(
  $q$select * from public.verify_api_key('sk_live_abc123', 'whatever')$q$,
  'a signed-in user cannot call verify_api_key'
);

reset role;
select test.eq(
  (select community_id from public.verify_api_key(
     'sk_live_abc123', encode(extensions.digest('the-real-key', 'sha256'), 'hex'))),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'a correct key verifies and returns its community'
);
select test.eq(
  test.visible($q$select * from public.verify_api_key(
     'sk_live_abc123', encode(extensions.digest('wrong-key', 'sha256'), 'hex'))$q$),
  0::bigint,
  'a wrong key verifies to nothing'
);
select test.ok(
  (select last_used_at is not null from public.api_keys
    where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'a successful verification stamps last_used_at'
);

update public.api_keys set revoked_at = now()
 where id = 'eeeeeeee-0000-0000-0000-000000000001';
select test.eq(
  test.visible($q$select * from public.verify_api_key(
     'sk_live_abc123', encode(extensions.digest('the-real-key', 'sha256'), 'hex'))$q$),
  0::bigint,
  'a revoked key stops verifying'
);

-- ---------------------------------------------------------------------------
-- Anonymous users get nothing
-- ---------------------------------------------------------------------------
reset role;
select test.act_anon();
select test.eq(test.visible('select id from public.communities'), 0::bigint,
  'anonymous callers see no communities');
select test.eq(test.visible('select id from public.announcements'), 0::bigint,
  'anonymous callers see no announcements');

reset role;
