'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { bookAmenity } from './actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Checking…' : label}
    </Button>
  );
}

function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function BookingForm({
  slug,
  amenityId,
  requiresApproval,
  maxHours,
}: {
  slug: string;
  amenityId: string;
  requiresApproval: boolean;
  maxHours: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(bookAmenity, EMPTY_STATE);

  const hourOptions = Array.from({ length: Math.max(1, maxHours) }, (_, i) => i + 1);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="amenity_id" value={amenityId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="From" htmlFor={`start-${amenityId}`} error={state.fieldErrors?.starts_at}>
          {(control) => (
            <Input {...control} name="starts_at" type="datetime-local" defaultValue={localNow()} />
          )}
        </Field>
        <Field label="For" htmlFor={`hours-${amenityId}`} error={state.fieldErrors?.ends_at}>
          {(control) => (
            <Select {...control} name="hours" defaultValue="1">
              {hourOptions.map((hour) => (
                <option key={hour} value={hour}>
                  {hour} {hour === 1 ? 'hour' : 'hours'}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Guests" htmlFor={`guests-${amenityId}`} error={state.fieldErrors?.guests}>
          {(control) => (
            <Input {...control} name="guests" type="number" min={0} max={500} defaultValue={0} />
          )}
        </Field>
      </div>

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-sm">
          {state.success}
        </p>
      ) : null}

      <Submit label={requiresApproval ? 'Request slot' : 'Book slot'} />
    </form>
  );
}
