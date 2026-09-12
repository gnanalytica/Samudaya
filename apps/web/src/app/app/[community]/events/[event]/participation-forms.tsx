'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { joinActivity, leaveActivity, volunteer, withdrawVolunteer } from '../actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

/**
 * Joining an activity collects a few optional details. They are behind a
 * disclosure so the common case — "yes, count me in" — stays one tap.
 */
export function JoinActivityForm({
  slug,
  eventSlug,
  activityId,
  activityName,
  joined,
}: {
  slug: string;
  eventSlug: string;
  activityId: string;
  activityName: string;
  joined: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(joinActivity, EMPTY_STATE);
  const [showDetails, setShowDetails] = useState(false);

  if (joined) {
    return (
      <form action={leaveActivity} className="flex items-center gap-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="event" value={eventSlug} />
        <input type="hidden" name="activity_id" value={activityId} />
        <span className="text-success inline-flex items-center gap-1.5 text-sm font-medium">
          <Check className="size-4" aria-hidden="true" />
          You’re in
        </span>
        <button
          type="submit"
          className="text-ink-muted hover:text-ink text-sm underline underline-offset-4"
        >
          Withdraw
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
      <input type="hidden" name="activity_id" value={activityId} />

      {showDetails ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Performance type" htmlFor={`type-${activityId}`}>
            {(control) => <Input {...control} name="performance_type" placeholder="Solo, group…" />}
          </Field>
          <Field label="Age group" htmlFor={`age-${activityId}`}>
            {(control) => <Input {...control} name="age_group" placeholder="Adult, kids…" />}
          </Field>
          <Field label="Experience" htmlFor={`exp-${activityId}`}>
            {(control) => <Input {...control} name="experience" placeholder="Beginner" />}
          </Field>
          <Field label="Anything we should know?" htmlFor={`req-${activityId}`}>
            {(control) => <Textarea {...control} name="special_requirements" rows={2} />}
          </Field>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Submit label={`Join ${activityName}`} busy="Joining…" />
        <button
          type="button"
          onClick={() => setShowDetails((open) => !open)}
          className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ChevronDown
            className={
              showDetails
                ? 'size-3.5 rotate-180 transition-transform'
                : 'size-3.5 transition-transform'
            }
            aria-hidden="true"
          />
          {showDetails ? 'Hide details' : 'Add details'}
        </button>
      </div>
    </form>
  );
}

export function VolunteerForm({
  slug,
  eventSlug,
  roleId,
  signedUp,
  stillNeeded,
}: {
  slug: string;
  eventSlug: string;
  roleId: string;
  signedUp: boolean;
  stillNeeded: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(volunteer, EMPTY_STATE);

  if (signedUp) {
    return (
      <form action={withdrawVolunteer} className="flex items-center gap-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="event" value={eventSlug} />
        <input type="hidden" name="role_id" value={roleId} />
        <span className="text-success inline-flex items-center gap-1.5 text-sm font-medium">
          <Check className="size-4" aria-hidden="true" />
          Signed up
        </span>
        <button
          type="submit"
          className="text-ink-muted hover:text-ink text-sm underline underline-offset-4"
        >
          Withdraw
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
      <input type="hidden" name="role_id" value={roleId} />
      <Submit label={stillNeeded > 0 ? 'Volunteer' : 'Join anyway'} busy="Signing up…" />
      {state.error ? (
        <span role="alert" className="text-danger text-sm">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
