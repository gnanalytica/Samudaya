'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FocusFirstError } from '@/components/focus-first-error';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { useResetOnSuccess } from '@/lib/use-reset-on-success';
import { suggestIdea } from '../events/actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Sending…' : 'Send to the committee'}
    </Button>
  );
}

/**
 * An activity worth doing, or something the committee should look at — for the
 * society, or for whichever event is running. The committee opens it for
 * voting, and then everybody has a say.
 *
 * It used to be able to say only "the society", which meant a resident who
 * wanted to suggest something for Dasara had to find Dasara's own page first.
 * The events are passed in rather than fetched here so the choice is the same
 * list the server will accept.
 */
export function SocietySuggestionForm({
  slug,
  events,
}: {
  slug: string;
  /** Published events, newest question first. Empty is fine: the society is. */
  events: { slug: string; name: string; emoji: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(suggestIdea, EMPTY_STATE);
  const ref = useResetOnSuccess(state);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <FocusFirstError signal={state} />
      <input type="hidden" name="slug" value={slug} />
      {events.length ? (
        <Field label="What is it about?" htmlFor="ss-event" error={state.fieldErrors?.event}>
          {(control) => (
            <Select {...control} name="event" defaultValue="">
              <option value="">The society</option>
              {events.map((event) => (
                <option key={event.slug} value={event.slug}>
                  {event.emoji} {event.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <Field label="Type" htmlFor="ss-kind">
          {(control) => (
            <Select {...control} name="kind" defaultValue="idea">
              <option value="idea">An idea</option>
              <option value="activity">An activity</option>
            </Select>
          )}
        </Field>
        <Field label="Suggestion" htmlFor="ss-name" error={state.fieldErrors?.name} required>
          {(control) => (
            <Input
              {...control}
              name="name"
              placeholder="Weekly badminton on the terrace"
              maxLength={120}
            />
          )}
        </Field>
      </div>
      <Field label="Details" htmlFor="ss-desc" hint="Optional. What it involves, and why.">
        {(control) => <Textarea {...control} name="description" rows={3} maxLength={2000} />}
      </Field>
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
      <Submit />
    </form>
  );
}
