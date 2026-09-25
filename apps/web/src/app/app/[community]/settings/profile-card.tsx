'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { updateProfile } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </Button>
  );
}

export function ProfileCard({
  slug,
  fullName,
  email,
  phone,
}: {
  slug: string;
  fullName: string;
  email: string;
  /** Empty for everybody who registered before the forms asked for one. */
  phone: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfile, EMPTY_STATE);

  return (
    <Card>
      <CardHeader title="Your details" description="How you appear to your neighbours." />
      <CardBody>
        <form action={action} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <Field label="Name" htmlFor="full_name" error={state.fieldErrors?.full_name} required>
            {(control) => <Input {...control} name="full_name" defaultValue={fullName} required />}
          </Field>
          <Field
            label="Phone number"
            htmlFor="phone"
            error={state.fieldErrors?.phone}
            hint="Only staff and the committee see it."
          >
            {(control) => (
              <Input
                {...control}
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={phone}
                placeholder="98450 10101"
                autoComplete="tel"
                maxLength={20}
              />
            )}
          </Field>
          <Field label="Email" htmlFor="email" hint="Your sign-in email. It can’t be changed here.">
            {(control) => <Input {...control} value={email} readOnly disabled />}
          </Field>
          {state.success ? (
            <p role="status" className="text-success text-sm">
              {state.success}
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}
          <Submit />
        </form>
      </CardBody>
    </Card>
  );
}
