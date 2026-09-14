'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { societySlug } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { createSociety } from './actions';
import type { ActionState } from '@/lib/action-state';

const initial: ActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create the society'}
    </Button>
  );
}

/**
 * Founding a society: the name, the city, and nothing else that can wait.
 *
 * Flats, the catalogue and the UPI ID are the setup checklist's job — asking
 * for them here would turn "start your society" into a form nobody finishes on
 * a phone. The address is offered because it is the one checklist step whose
 * answer the founder already has in their head.
 */
export function CreateFlow({ initialCity = '' }: { initialCity?: string }) {
  const [state, action] = useActionState(createSociety, initial);
  const [name, setName] = useState('');

  // What the web address will look like. create_society() derives the real one
  // the same way, and adds a suffix if another society got there first.
  const preview = name.trim() ? societySlug(name) : '';

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-4">
          <Field
            label="Society name"
            htmlFor="cs-name"
            error={state.fieldErrors?.name}
            hint={
              preview ? (
                <>
                  Residents will find it at <span className="font-mono">/app/{preview}</span>
                </>
              ) : (
                'As it appears on the gate — residents should recognise it.'
              )
            }
            required
          >
            {(control) => (
              <Input
                {...control}
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Shraddha Whitecliff"
                autoComplete="organization"
                autoFocus
                maxLength={120}
                required
              />
            )}
          </Field>

          <Field label="City" htmlFor="cs-city" error={state.fieldErrors?.city} required>
            {(control) => (
              <Input
                {...control}
                name="city"
                defaultValue={initialCity}
                placeholder="Bengaluru"
                autoComplete="address-level2"
                maxLength={80}
                required
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field
              label="Address"
              htmlFor="cs-address"
              error={state.fieldErrors?.address}
              hint="Optional — you can add this later."
            >
              {(control) => (
                <Input
                  {...control}
                  name="address"
                  placeholder="Seegehalli, Whitefield"
                  autoComplete="street-address"
                  maxLength={300}
                />
              )}
            </Field>
            <Field label="PIN code" htmlFor="cs-pincode" error={state.fieldErrors?.pincode}>
              {(control) => (
                <Input
                  {...control}
                  name="pincode"
                  inputMode="numeric"
                  placeholder="560067"
                  autoComplete="postal-code"
                  maxLength={6}
                  className="sm:w-28"
                />
              )}
            </Field>
          </div>

          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}

          <Submit />
          <p className="text-ink-subtle flex items-start gap-2 text-xs">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            You become the first committee member. Next you’ll add your flats and get a Society code
            to share with residents.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
