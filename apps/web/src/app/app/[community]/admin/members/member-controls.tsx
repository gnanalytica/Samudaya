'use client';

import { useActionState } from 'react';
import { SUGGESTED_TITLES, TITLE_MAX_LENGTH } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { setSpendingApprover, setSpendingRestriction, updateMemberTitle } from './actions';

export const TITLE_OPTIONS_ID = 'member-title-options';

/** Rendered once per page; every title input points its `list` at it. */
export function TitleOptions() {
  return (
    <datalist id={TITLE_OPTIONS_ID}>
      {SUGGESTED_TITLES.map((title) => (
        <option key={title} value={title} />
      ))}
    </datalist>
  );
}

function Feedback({ state }: { state: ActionState }) {
  const message = state.error ?? state.fieldErrors?.title;
  if (message) {
    return (
      <p role="alert" className="text-danger mt-1 text-xs">
        {message}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-success mt-1 text-xs">
        {state.success}
      </p>
    );
  }
  return null;
}

export function TitleForm({
  slug,
  membershipId,
  title,
  memberName,
}: {
  slug: string;
  membershipId: string;
  title: string | null;
  memberName: string;
}) {
  const [state, action, pending] = useActionState(updateMemberTitle, EMPTY_STATE);

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="membership_id" value={membershipId} />
      <div className="flex items-center gap-2">
        <label htmlFor={`title-${membershipId}`} className="sr-only">
          Title for {memberName}
        </label>
        <Input
          id={`title-${membershipId}`}
          name="title"
          list={TITLE_OPTIONS_ID}
          defaultValue={title ?? ''}
          maxLength={TITLE_MAX_LENGTH}
          placeholder="e.g. Treasurer"
          className="h-8 w-40 py-1 text-xs"
        />
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function ApproverToggle({
  slug,
  membershipId,
  approves,
  canManage,
}: {
  slug: string;
  membershipId: string;
  approves: boolean;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(setSpendingApprover, EMPTY_STATE);

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="membership_id" value={membershipId} />
      <input type="hidden" name="approves_spending" value={approves ? 'false' : 'true'} />
      {/* Why it is disabled is explained once, in the Spending approval card. */}
      <label className="text-ink-muted flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={approves}
          disabled={!canManage || pending}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="border-border-strong size-4 rounded"
        />
        Spending approver
      </label>
      <Feedback state={state} />
    </form>
  );
}

export function SpendingApprovalCard({
  slug,
  restricted,
  approvers,
  canManage,
}: {
  slug: string;
  restricted: boolean;
  approvers: string[];
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(setSpendingRestriction, EMPTY_STATE);

  return (
    <Card>
      <CardHeader
        title="Spending approval"
        description={
          restricted
            ? 'Only designated approvers can approve spending.'
            : 'Any admin can approve spending. Turn this on to limit it to people like the Treasurer.'
        }
      />
      <CardBody>
        <p className="text-ink text-sm">
          <span className="text-ink-muted">Approvers: </span>
          {approvers.length ? approvers.join(', ') : 'none yet'}
        </p>
        <p className="text-ink-subtle mt-1 text-xs">
          Mark approvers with the “Spending approver” checkbox next to an admin below. Nobody can
          approve an expense they submitted themselves, whichever way this is set.
        </p>
        <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="restrict" value={restricted ? 'false' : 'true'} />
          <Button
            type="submit"
            size="sm"
            variant={restricted ? 'secondary' : 'primary'}
            disabled={!canManage || pending || (!restricted && approvers.length === 0)}
          >
            {restricted ? 'Let any admin approve' : 'Only designated approvers can approve'}
          </Button>
          {!canManage ? (
            <span className="text-ink-subtle text-xs">
              Only an owner or an existing approver can change this.
            </span>
          ) : !restricted && approvers.length === 0 ? (
            <span className="text-ink-subtle text-xs">Mark at least one approver first.</span>
          ) : null}
        </form>
        <Feedback state={state} />
      </CardBody>
    </Card>
  );
}
