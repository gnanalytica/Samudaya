'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ROLE_LABEL, ASSIGNABLE_ROLES, type Role } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { changeMemberRole, removeMember } from './actions';

function Submit({ label, variant }: { label: string; variant?: 'secondary' | 'ghost' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? '…' : label}
    </Button>
  );
}

function Message({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-danger mt-1 text-xs">
        {state.error}
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

export function RoleForm({
  slug,
  membershipId,
  role,
  name,
}: {
  slug: string;
  membershipId: string;
  role: Role;
  name: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(changeMemberRole, EMPTY_STATE);
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="membership_id" value={membershipId} />
      <div className="flex items-center gap-2">
        <label htmlFor={`role-${membershipId}`} className="sr-only">
          Role for {name}
        </label>
        <Select
          id={`role-${membershipId}`}
          name="role"
          defaultValue={role}
          className="h-8 w-32 py-1 text-xs"
        >
          {ASSIGNABLE_ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABEL[option]}
            </option>
          ))}
        </Select>
        <Submit label="Save" variant="secondary" />
      </div>
      <Message state={state} />
    </form>
  );
}

export function RemoveForm({
  slug,
  membershipId,
  name,
}: {
  slug: string;
  membershipId: string;
  name: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(removeMember, EMPTY_STATE);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${name} from the society?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="membership_id" value={membershipId} />
      <Submit label="Remove" variant="ghost" />
      <Message state={state} />
    </form>
  );
}
