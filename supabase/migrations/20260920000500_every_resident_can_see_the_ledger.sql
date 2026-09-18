-- ============================================================================
-- Samudaya · 0920.0500 · One ledger, for everybody
-- ----------------------------------------------------------------------------
-- A resident could already see where the money went for the event they happened
-- to be looking at. Nowhere could they see the society's money as one thing:
-- what came in last Deepavali, what it was spent on, what is left, and what the
-- year before that looked like. The history existed and was unreachable, which
-- for a transparency ledger is close to not existing.
--
-- society_ledger is that history: every confirmed contribution and every
-- approved bill, across every event, as one list a resident can read.
--
-- The line it draws, which the society chose deliberately:
--
--   · money out names the vendor, the amount, the approver and the bill. It is
--     the society's money being spent by people the society elected, and there
--     is no version of this where that is private.
--   · money in names the payer and their flat. Who gave how much is the thing a
--     contribution list has always said, on the noticeboard and in the minutes;
--     withholding it makes the fund harder to trust rather than safer. So the
--     name and the flat are here, and nothing else about the person is — no
--     phone, no email, no address. That is the same line society_people() draws
--     for the directory, which makes it one rule rather than two.
--   · a payment nobody has confirmed yet is not in here at all. It is a claim,
--     and a ledger of claims is what this whole feature is trying to replace.
--
-- Contributions stay unreadable row-by-row under RLS, so this is a definer view
-- with app.is_member() as its gate, the same shape as event_stats. A definer
-- view can read anything, which is exactly why the column list matters: it
-- selects full_name and the flat and stops there, so widening it later has to
-- be a deliberate edit to this file rather than a policy nobody reread.
-- ============================================================================

create view public.society_ledger
with (security_invoker = false) as
select
  ('in:' || c.id::text)                as id,
  c.community_id,
  c.event_id,
  e.slug                               as event_slug,
  e.name                               as event_name,
  'in'::text                           as direction,
  c.paid_at                            as happened_at,
  c.amount                             as amount,
  -- Who paid. Their name where there is an account behind the payment, the flat
  -- where staff recorded cash against a door rather than a person, and the
  -- method for a sponsor or a guest who is neither.
  coalesce(
    payer.full_name,
    nullif(btrim(coalesce(u.block || ' ', '') || u.number), ''),
    initcap(c.method::text)
  )                                    as counterpart,
  -- What sits under the name: the flat and how it was paid. Whichever of those
  -- the line above already used as its headline is left out here rather than
  -- printed twice, and a line with nothing left to add returns null so a screen
  -- can skip it.
  case
    when payer.full_name is not null then
      nullif(
        concat_ws(
          ' · ',
          nullif(btrim(coalesce(u.block || ' ', '') || u.number), ''),
          initcap(c.method::text)
        ),
        ''
      )
    when u.id is not null then initcap(c.method::text)
  end                                  as detail,
  c.receipt_no                         as receipt_no,
  null::text                           as document_url,
  v.full_name                          as confirmed_by,
  c.verified_at                        as confirmed_at,
  c.membership_id                      as membership_id
  from public.contributions c
  join public.events e on e.id = c.event_id
  left join public.units u on u.id = c.unit_id
  left join public.memberships pm on pm.id = c.membership_id
  left join public.profiles payer on payer.id = pm.user_id
  left join public.memberships vm on vm.id = c.verified_by
  left join public.profiles v on v.id = vm.user_id
 where c.status = 'succeeded'
   and app.is_member(c.community_id)

union all

select
  ('out:' || x.id::text),
  x.community_id,
  x.event_id,
  e.slug,
  e.name,
  'out'::text,
  x.spent_on::timestamptz,
  -x.amount,
  coalesce(x.vendor, 'Vendor not recorded'),
  coalesce(x.category, 'Uncategorised'),
  null::bigint,
  x.bill_url,
  a.full_name,
  x.approved_at,
  null::uuid
  from public.expenses x
  join public.events e on e.id = x.event_id
  left join public.memberships am on am.id = x.approved_by
  left join public.profiles a on a.id = am.user_id
 where x.status = 'approved'
   and app.is_member(x.community_id);

grant select on public.society_ledger to authenticated, service_role;

comment on view public.society_ledger is
  'Every confirmed contribution and approved bill in a society, as one list any '
  'member may read. Money in names the payer and their flat and nothing else '
  'about them; money out names the vendor. Unconfirmed payments are not in it.';

-- ---------------------------------------------------------------------------
-- What it adds up to
-- ---------------------------------------------------------------------------
-- The same aggregate a resident would otherwise have to do by hand across
-- every event, which is how a ledger stops getting read.
create view public.society_money
with (security_invoker = false) as
select
  c.id                                   as community_id,
  coalesce(sum(l.amount) filter (where l.direction = 'in'), 0)::numeric(14,2)  as total_in,
  coalesce(-sum(l.amount) filter (where l.direction = 'out'), 0)::numeric(14,2) as total_out,
  coalesce(sum(l.amount), 0)::numeric(14,2)                                    as balance,
  count(*) filter (where l.direction = 'in')::integer                          as payments_in,
  count(*) filter (where l.direction = 'out')::integer                         as payments_out,
  max(l.happened_at)                                                           as last_movement_at
  from public.communities c
  left join public.society_ledger l on l.community_id = c.id
 where app.is_member(c.id)
 group by c.id;

grant select on public.society_money to authenticated, service_role;

comment on view public.society_money is
  'Society-wide totals over society_ledger: in, out, and what is left.';

-- ---------------------------------------------------------------------------
-- One member's history, for the member and the committee
-- ---------------------------------------------------------------------------
/**
 * Everything one member has done in a society: what they paid, what they took
 * part in, and what they suggested — in one call, so a screen does not have to
 * make four and stitch them together.
 *
 * You may ask about yourself. The committee may ask about anyone, because
 * "has A-204 paid?" is the question that gets asked at every meeting and the
 * alternative is somebody keeping a private spreadsheet. Staff may not: they
 * run the events, and a member's whole history is not needed to do that.
 *
 * Unconfirmed payments are included when you ask about yourself — you are
 * entitled to know your own report is still waiting — and for the committee,
 * who are the ones who can do something about it.
 */
create or replace function public.member_history(p_membership_id uuid)
returns table (
  kind        text,
  happened_at timestamptz,
  title       text,
  detail      text,
  amount      numeric,
  status      text,
  event_slug  text,
  event_name  text
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select m.id, m.community_id
      from public.memberships m
     where m.id = p_membership_id
       and (
         m.id = app.my_membership_id(m.community_id)
         or app.is_committee(m.community_id)
       )
  )
  select 'payment', c.paid_at,
         app.money(c.amount),
         coalesce(c.reference, initcap(c.method::text)),
         c.amount, c.status::text, e.slug, e.name
    from target t
    join public.contributions c on c.membership_id = t.id
    join public.events e on e.id = c.event_id

  union all

  select 'activity', ap.joined_at,
         a.name,
         coalesce(ap.participant_name, 'You'),
         null, 'registered', e.slug, e.name
    from target t
    join public.activity_participants ap on ap.membership_id = t.id
    join public.event_activities a on a.id = ap.activity_id
    join public.events e on e.id = a.event_id

  union all

  select 'suggestion', s.created_at,
         s.name,
         initcap(s.kind::text),
         null, s.status::text, e.slug, e.name
    from target t
    join public.activity_suggestions s on s.suggested_by = t.id
    left join public.events e on e.id = s.event_id

  order by 2 desc
  limit 500;
$$;

grant execute on function public.member_history(uuid) to authenticated;
