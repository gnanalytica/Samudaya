'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { updateSocietyUpi } from './actions';

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save UPI details'}
    </Button>
  );
}

export function SocietyUpiForm({
  slug,
  vpa,
  payeeName,
}: {
  slug: string;
  vpa: string | null;
  payeeName: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateSocietyUpi, EMPTY_STATE);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Society UPI ID"
          htmlFor="upi-vpa"
          error={state.fieldErrors?.upi_vpa}
          hint="Use the association’s bank account, not a personal one."
          required
        >
          {(control) => (
            <Input
              {...control}
              name="upi_vpa"
              placeholder="whitecliff.rwa@okaxis"
              defaultValue={vpa ?? ''}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          )}
        </Field>
        <Field
          label="Payee name"
          htmlFor="upi-payee"
          error={state.fieldErrors?.upi_payee_name}
          hint="Shown in the resident's UPI app before they pay."
          required
        >
          {(control) => (
            <Input
              {...control}
              name="upi_payee_name"
              placeholder="Whitecliff Residents Association"
              defaultValue={payeeName ?? ''}
              required
            />
          )}
        </Field>
      </div>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : state.success ? (
        <p role="status" className="text-success text-sm">
          {state.success}
        </p>
      ) : null}
      <Save />
    </form>
  );
}
