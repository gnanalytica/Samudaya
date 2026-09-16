'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { suggestToSociety } from '../events/actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Sending…' : 'Send to the committee'}
    </Button>
  );
}

/**
 * Anything for the society rather than for one event: an activity worth doing,
 * or something the committee should look at. The committee opens it for
 * voting, and then everybody has a say.
 */
export function SocietySuggestionForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<ActionState, FormData>(suggestToSociety, EMPTY_STATE);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (formData) => {
        await action(formData);
        ref.current?.reset();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="slug" value={slug} />
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
              required
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
