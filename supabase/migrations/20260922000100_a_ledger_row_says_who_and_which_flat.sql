-- ============================================================================
-- Samudaya · 0922.0100 · Every ledger row says who, which flat, and how
-- ----------------------------------------------------------------------------
-- Reading the Money page, three rows in a row said three different things:
--
--   Pranav Aditya        Upi · 21 Sept 2026 · Dasara      -- a name, no flat
--   Surya Pratap         E 802 · Upi · 21 Sept 2026       -- both
--   A 703                Cash · 21 Sept 2026              -- a flat, no name
--
-- Not a display bug. society_ledger built one `counterpart` out of
-- coalesce(name, flat, method) and then had `detail` carefully avoid repeating
-- whichever of those the headline had used. That is a layout decision written
-- in SQL, and it meant the view could only ever say one of the two things a
-- reader wants, because the other had been spent on the headline.
--
-- Underneath it, two real gaps in the data:
--
--   · a resident reporting their own payment sets membership_id and no
--     unit_id, so the row knew the person and not the flat;
--   · staff recording cash against a door set unit_id and no membership_id,
--     so the row knew the flat and not the person.
--
-- Both are recoverable from unit_occupants, and this fills them in — but only
-- from the occupancy that covered the day of the payment. Naming today's
-- resident on a payment the previous one made would be worse than the blank
-- it replaces, so the join is bounded by moved_in_on and moved_out_on rather
-- than simply taking whoever lives there now.
--
-- So the view stops composing sentences and starts emitting facts:
-- payer_name, unit_label and method, each free to be null on its own. The
-- screens put them together. counterpart and detail stay exactly where they
-- were, still meaning what they meant, so an older build of the phone app
-- keeps rendering.
--
-- The other half is evidence. Money out has carried `bill_url` since the
-- beginning and every member can open it: RLS on the bills bucket opens an
-- approved expense's bill to the whole society, and the ledger only ever
-- shows approved expenses. Money in carried `null::text` — the screenshot
-- existed on contributions.proof_path and no screen could reach it from here.
--
-- It is exposed now, to the people the payment-proofs bucket already lets
-- read it: staff and the committee, who check payments against it, and the
-- payer themselves. A neighbour gets null, and therefore no button, rather
-- than a button that fails when tapped — a UPI screenshot carries the payer's
-- handle and often their phone number, which is the one thing this ledger has
-- always refused to publish. Storage RLS is still the boundary; this only
-- stops the screen promising something it cannot deliver.
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
    -- Who paid. The account behind the payment, or — for cash staff recorded
    -- against a door — whoever the society had living there that day.
    coalesce(payer.full_name, resident.full_name)   as payer_name,
    -- Which flat. The one on the payment, or the one the payer lived in when
    -- they made it.
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

    -- The payer's flat, when the payment did not record one. Bounded by the
    -- dates so a member who has since moved is still shown against the flat
    -- they paid from.
    left join lateral (
      select u2.block, u2.number
        from public.unit_occupants o
        join public.units u2 on u2.id = o.unit_id
       where c.unit_id is null
         and c.membership_id is not null
         and o.membership_id = c.membership_id
         and (o.moved_in_on  is null or o.moved_in_on  <= c.paid_at::date)
         and (o.moved_out_on is null or o.moved_out_on >= c.paid_at::date)
       order by o.is_primary desc, o.moved_in_on desc nulls last
       limit 1
    ) home on true

    -- The flat's resident, when the payment named no account. Same date
    -- bounds, for the same reason in the other direction.
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
  -- Unchanged in meaning, and now with more to say: the name where there is
  -- one to find, the flat otherwise, the method for a sponsor who is neither.
  coalesce(c.payer_name, c.unit_label, c.method_label)  as counterpart,
  case
    when c.payer_name is not null
      then nullif(concat_ws(' · ', c.unit_label, c.method_label), '')
    when c.unit_label is not null then c.method_label
  end                                  as detail,
  c.receipt_no                         as receipt_no,
  -- The payer's screenshot, to the people the bucket already opens it to.
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
  -- Money out is paid to a vendor, not by a flat. Null rather than a stand-in,
  -- so a screen can tell the two shapes apart without reading `direction`.
  null::text,
  null::text,
  null::text
  from public.expenses x
  join public.events e on e.id = x.event_id
  left join public.memberships am on am.id = x.approved_by
  left join public.profiles a on a.id = am.user_id
 where x.status = 'approved'
   and app.is_member(x.community_id);

comment on view public.society_ledger is
  'Every confirmed contribution and approved bill in a society, as one list any '
  'member may read. Money in names the payer, their flat and how they paid, and '
  'nothing else about them; money out names the vendor. A bill is readable by '
  'every member; a payment screenshot only by the payer and by staff. '
  'Unconfirmed payments are not in it.';

comment on column public.society_ledger.payer_name is
  'Who paid: the account behind the payment, or the flat''s resident on the day '
  'for cash recorded against a door. Null for money out.';
comment on column public.society_ledger.unit_label is
  'The flat: the one recorded on the payment, or the payer''s on the day. Null '
  'for money out.';
comment on column public.society_ledger.method is
  'How the money arrived — Upi, Cash, Cheque. Null for money out.';
