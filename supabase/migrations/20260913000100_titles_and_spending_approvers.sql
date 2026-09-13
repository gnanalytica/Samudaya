-- ============================================================================
-- Samudaya · 20260913000100 · Position titles and designated spending approvers
-- ----------------------------------------------------------------------------
-- Roles decide what someone may do; a title says who they are to the society
-- ("President", "Treasurer", "Supervisor"). A paid estate supervisor, for
-- example, is a committee member with a "Supervisor" title.
--
-- Spending approval can be narrowed from "any admin" to "designated approvers
-- only" (typically the Treasurer and President). The switch and the approver
-- list are guarded so an admin cannot grant themselves approval rights or turn
-- the restriction off: only an owner or an existing approver may change either.
-- ============================================================================

alter table public.memberships
  add column title text,
  add column approves_spending boolean not null default false,
  add constraint memberships_title_length
    check (title is null or (length(btrim(title)) between 1 and 40));

alter table public.communities
  add column restrict_spending_approval boolean not null default false;

-- True when the caller may approve spending in this community right now.
create or replace function app.can_approve_spending(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or (
        app.is_admin(p_community)
        and (
          not coalesce((select c.restrict_spending_approval
                          from public.communities c where c.id = p_community), false)
          or exists (
            select 1 from public.memberships m
             where m.community_id = p_community
               and m.user_id = (select auth.uid())
               and m.status = 'active'
               and m.approves_spending
          )
        )
      );
$$;

-- Owner or an existing designated approver: the people allowed to change who
-- approves spending.
create or replace function app.manages_spending_approval(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or app.member_role_in(p_community) = 'owner'
      or exists (
        select 1 from public.memberships m
         where m.community_id = p_community
           and m.user_id = (select auth.uid())
           and m.status = 'active'
           and m.role in ('admin', 'owner')
           and m.approves_spending
      );
$$;

grant execute on function app.can_approve_spending(uuid) to authenticated, service_role;
grant execute on function app.manages_spending_approval(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function app.guard_spending_approvers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.approves_spending is distinct from old.approves_spending
     and not app.manages_spending_approval(new.community_id) then
    raise exception 'Only an owner or an existing spending approver can change who approves spending'
      using errcode = '42501';
  end if;

  -- Approving spending is an admin power; a resident or committee member
  -- flagged as an approver would have a flag that does nothing.
  if new.approves_spending and new.role not in ('admin', 'owner') then
    raise exception 'Only admins and owners can be spending approvers'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger memberships_guard_spending_approvers
  before update on public.memberships
  for each row execute function app.guard_spending_approvers();

create or replace function app.guard_spending_restriction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'service_role'
     or new.restrict_spending_approval is not distinct from old.restrict_spending_approval then
    return new;
  end if;

  if not app.manages_spending_approval(new.id) then
    raise exception 'Only an owner or an existing spending approver can change this setting'
      using errcode = '42501';
  end if;

  if new.restrict_spending_approval and not exists (
    select 1 from public.memberships m
     where m.community_id = new.id
       and m.status = 'active'
       and m.approves_spending
  ) then
    raise exception 'Mark at least one spending approver before restricting approval'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger communities_guard_spending_restriction
  before update on public.communities
  for each row execute function app.guard_spending_restriction();

-- ---------------------------------------------------------------------------
-- review_expense: same rules as before, plus the approver restriction
-- ---------------------------------------------------------------------------

create or replace function public.review_expense(
  p_expense_id uuid,
  p_decision   public.expense_status,
  p_note       text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.expenses;
  v_actor uuid;
begin
  select * into v_row from public.expenses e where e.id = p_expense_id for update;
  if v_row.id is null then
    raise exception 'No such expense' using errcode = 'P0002';
  end if;

  if not app.is_admin(v_row.community_id) then
    raise exception 'Only a community admin can review an expense'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'A review must approve, reject, or request changes'
      using errcode = '22023';
  end if;

  -- Rejecting or asking for changes stays open to any admin; signing off money
  -- is what the restriction narrows.
  if p_decision = 'approved' and not app.can_approve_spending(v_row.community_id) then
    raise exception 'Only designated spending approvers can approve expenses in this community'
      using errcode = '42501';
  end if;

  v_actor := app.my_membership_id(v_row.community_id);

  -- Self-approval is how expense fraud happens in small committees.
  if p_decision = 'approved' and v_row.requested_by is not null
     and v_row.requested_by = v_actor then
    raise exception 'You cannot approve an expense you requested yourself'
      using errcode = '42501';
  end if;

  -- Once an event is closed its ledger is a published record.
  if exists (select 1 from public.events e where e.id = v_row.event_id and e.status = 'completed') then
    raise exception 'This event is closed; its ledger cannot be changed'
      using errcode = '42501';
  end if;

  update public.expenses
     set status = p_decision,
         approved_by = case when p_decision = 'approved' then v_actor else null end,
         approved_at = case when p_decision = 'approved' then now() else null end,
         review_note = p_note
   where id = p_expense_id
   returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.review_expense(uuid, public.expense_status, text)
  to authenticated, service_role;
