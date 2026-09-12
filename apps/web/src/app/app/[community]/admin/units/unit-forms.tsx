'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { addUnit, addUnitsBulk } from './actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Saving…' : label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-danger text-sm">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-success text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}

export function UnitForms({ slug }: { slug: string }) {
  const [single, singleAction] = useActionState<ActionState, FormData>(addUnit, EMPTY_STATE);
  const [bulk, bulkAction] = useActionState<ActionState, FormData>(addUnitsBulk, EMPTY_STATE);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Add a unit" />
        <CardBody>
          <form action={singleAction} className="space-y-4">
            <input type="hidden" name="slug" value={slug} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Block" htmlFor="block" error={single.fieldErrors?.block}>
                {(control) => <Input {...control} name="block" placeholder="A" />}
              </Field>
              <Field label="Number" htmlFor="number" error={single.fieldErrors?.number} required>
                {(control) => <Input {...control} name="number" placeholder="101" required />}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Floor" htmlFor="floor" error={single.fieldErrors?.floor}>
                {(control) => <Input {...control} name="floor" type="number" placeholder="1" />}
              </Field>
            </div>
            <Feedback state={single} />
            <Submit label="Add unit" />
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Add many at once"
          description="One per line: “A,101” or just “101”. Re-running skips ones that already exist."
        />
        <CardBody>
          <form action={bulkAction} className="space-y-4">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Units" htmlFor="units" error={bulk.fieldErrors?.units} required>
              {(control) => (
                <Textarea
                  {...control}
                  name="units"
                  rows={6}
                  placeholder={'A,101\nA,102\nB,201'}
                  required
                  className="font-mono text-sm"
                />
              )}
            </Field>
            <Feedback state={bulk} />
            <Submit label="Add units" />
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
