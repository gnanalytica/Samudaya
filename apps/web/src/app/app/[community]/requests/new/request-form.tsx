'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { REQUEST_CATEGORY_LABEL, REQUEST_PRIORITY_LABEL, unitLabel } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { createRequest } from '../actions';

type Unit = { id: string; block: string | null; number: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Submitting…' : 'Submit request'}
    </Button>
  );
}

export function RequestForm({ slug, units }: { slug: string; units: Unit[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createRequest, EMPTY_STATE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <Field label="What’s the problem?" htmlFor="title" error={state.fieldErrors?.title} required>
        {(control) => (
          <Input {...control} name="title" placeholder="Leaking tap in the kitchen" required />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" error={state.fieldErrors?.category}>
          {(control) => (
            <Select {...control} name="category" defaultValue="other">
              {Object.entries(REQUEST_CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Priority" htmlFor="priority" error={state.fieldErrors?.priority}>
          {(control) => (
            <Select {...control} name="priority" defaultValue="normal">
              {Object.entries(REQUEST_PRIORITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {/* Only worth asking when the person is attached to more than one flat. */}
      {units.length > 1 ? (
        <Field label="Which unit?" htmlFor="unit_id" error={state.fieldErrors?.unit_id}>
          {(control) => (
            <Select {...control} name="unit_id" defaultValue={units[0]?.id}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unitLabel(unit)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : units.length === 1 ? (
        <input type="hidden" name="unit_id" value={units[0]!.id} />
      ) : null}

      <Field
        label="Details"
        htmlFor="description"
        error={state.fieldErrors?.description}
        hint="When did it start? Anything the team should bring?"
      >
        {(control) => (
          <Textarea
            {...control}
            name="description"
            rows={4}
            placeholder="Dripping since Monday morning. Getting worse."
          />
        )}
      </Field>

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
