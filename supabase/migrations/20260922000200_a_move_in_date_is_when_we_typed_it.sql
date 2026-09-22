-- ============================================================================
-- Samudaya · 0922.0200 · A move-in date is when somebody typed it in
-- ----------------------------------------------------------------------------
-- 0922.0100 taught society_ledger to fill in the half a payment did not
-- record: the flat, for a resident who reported their own payment, and the
-- name, for cash staff recorded against a door. Both lookups were bounded by
-- the occupancy that covered the day of the payment, so that a payment the
-- previous tenant made is never attributed to the current one.
--
-- That bound is right in one direction and wrong in the other, because
-- moved_in_on is not when the person moved in. It is `current_date` at the
-- moment somebody was seated in the app — every path that creates an
-- occupancy sets it that way. For a society onboarding now, everyone's
-- move-in date is "today", so every payment they have ever made falls before
-- it and the bound throws away the very rows it was meant to help.
--
-- The two directions carry different risks:
--
--   flat → name   "A 703 paid ₹500 in cash — who was that?" Answering with
--                 whoever happens to live there now can put a neighbour's
--                 name against money they never paid. That is the cardinal
--                 sin of a transparency ledger, so the bound stays hard here.
--
--   person → flat "Tom paid ₹1,001 — which flat is he?" Tom paid either way.
--                 This only chooses a label, and the worst case is a stale
--                 flat next to a correct name. So: prefer an occupancy that
--                 covered the day, fall back to where they live now, and only
--                 then to the last place they lived.
--
-- Nothing else about the view changes.
-- ============================================================================

create or replace view public.society_ledger
with (security_invoker = false) as
with money_in as (
  select
    c.id,
    c.community_id,
    c.event_id,
    c.amount,
    c.method,
    c.paid_at,
    c.receipt_no,
    c.proof_path,
    c.membership_id,
    c.verified_at,
    e.slug                             as event_slug,
    e.name                             as event_name,
    v.full_name                        as verified_by_name,
    coalesce(payer.full_name, resident.full_name)   as payer_name,
    coalesce(
      nullif(btrim(coalesce(u.block || ' ', '') || u.number), ''),
      nullif(btrim(coalesce(home.block || ' ', '') || home.number), '')
    )                                               as unit_label,
    initcap(c.method::text)                         as method_label
    from public.contributions c
    join public.events e on e.id = c.event_id
    left join public.units u on u.id = c.unit_id
    left join public.memberships pm on pm.id = c.membership_id
    left join public.profiles payer on payer.id = pm.user_id
    left join public.memberships vm on vm.id = c.verified_by
    left join public.profiles v on v.id = vm.user_id

    -- The payer's flat, when the payment did not record one. We already know
    -- who paid; this only picks the label to print beside their name, so a
    -- covering occupancy is preferred but never required.
    left join lateral (
      select u2.block, u2.number
        from public.unit_occupants o
        join public.units u2 on u2.id = o.unit_id
       where c.unit_id is null
         and c.membership_id is not null
         and o.membership_id = c.membership_id
       order by
         -- An occupancy that covered the day they paid wins outright.
         ((o.moved_in_on  is null or o.moved_in_on  <= c.paid_at::date)
          and (o.moved_out_on is null or o.moved_out_on >= c.paid_at::date)) desc,
         -- Then where they live now, then the last place they lived.
         (o.moved_out_on is null) desc,
         o.is_primary desc,
         o.moved_in_on desc nulls last
       limit 1
    ) home on true

    -- The flat's resident, when the payment named no account. Hard-bounded:
    -- this one decides *who paid*, and naming the wrong neighbour is worse
    -- than leaving the row with only its flat.
    left join lateral (
      select p.full_name
        from public.unit_occupants o
        join public.memberships m on m.id = o.membership_id
        join public.profiles p on p.id = m.user_id
       where c.membership_id is null
         and c.unit_id is not null
         and o.unit_id = c.unit_id
         and (o.moved_in_on  is null or o.moved_in_on  <= c.paid_at::date)
         and (o.moved_out_on is null or o.moved_out_on >= c.paid_at::date)
       order by o.is_primary desc, o.moved_in_on desc nulls last
       limit 1
    ) resident on true

   where c.status = 'succeeded'
     and app.is_member(c.community_id)
)
select
  ('in:' || c.id::text)                as id,
  c.community_id,
  c.event_id,
  c.event_slug,
  c.event_name,
  'in'::text                           as direction,
  c.paid_at                            as happened_at,
  c.amount                             as amount,
  coalesce(c.payer_name, c.unit_label, c.method_label)  as counterpart,
  case
    when c.payer_name is not null
      then nullif(concat_ws(' · ', c.unit_label, c.method_label), '')
    when c.unit_label is not null then c.method_label
  end                                  as detail,
  c.receipt_no                         as receipt_no,
  case
    when app.is_staff(c.community_id) then c.proof_path
    when c.membership_id is not null
     and c.membership_id = app.my_membership_id(c.community_id) then c.proof_path
  end                                  as document_url,
  c.verified_by_name                   as confirmed_by,
  c.verified_at                        as confirmed_at,
  c.membership_id                      as membership_id,
  c.payer_name                         as payer_name,
  c.unit_label                         as unit_label,
  c.method_label                       as method
  from money_in c

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
  null::uuid,
  null::text,
  null::text,
  null::text
  from public.expenses x
  join public.events e on e.id = x.event_id
  left join public.memberships am on am.id = x.approved_by
  left join public.profiles a on a.id = am.user_id
 where x.status = 'approved'
   and app.is_member(x.community_id);

comment on column public.society_ledger.unit_label is
  'The flat: the one recorded on the payment, else the payer''s at the time, '
  'else where they live now. Null for money out.';
