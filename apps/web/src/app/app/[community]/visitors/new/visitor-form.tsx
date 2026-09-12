'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { VISITOR_KIND_LABEL, unitLabel } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { createVisitorPass } from '../actions';

type Unit = { id: string; block: string | null; number: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create gate pass'}
    </Button>
  );
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in the viewer's own timezone. */
function localNow() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function VisitorForm({ slug, units }: { slug: string; units: Unit[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createVisitorPass, EMPTY_STATE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <Field
        label="Visitor’s name"
        htmlFor="visitor_name"
        error={state.fieldErrors?.visitor_name}
        required
      >
        {(control) => <Input {...control} name="visitor_name" placeholder="Ravi Kumar" required />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="kind" error={state.fieldErrors?.kind}>
          {(control) => (
            <Select {...control} name="kind" defaultValue="guest">
              {Object.entries(VISITOR_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="How many people?" htmlFor="party_size" error={state.fieldErrors?.party_size}>
          {(control) => (
            <Input {...control} name="party_size" type="number" min={1} max={50} defaultValue={1} />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Expected at"
          htmlFor="expected_at"
          error={state.fieldErrors?.expected_at}
          required
        >
          {(control) => (
            <Input
              {...control}
              name="expected_at"
              type="datetime-local"
              defaultValue={localNow()}
              required
            />
          )}
        </Field>

        <Field label="Pass valid for" htmlFor="valid_hours" error={state.fieldErrors?.valid_until}>
          {(control) => (
            <Select {...control} name="valid_hours" defaultValue="6">
              <option value="2">2 hours</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">A day</option>
              <option value="168">A week</option>
            </Select>
          )}
        </Field>
      </div>

      <Field
        label="Phone"
        htmlFor="visitor_phone"
        error={state.fieldErrors?.visitor_phone}
        hint="Optional. International format, e.g. +919876543210."
      >
        {(control) => (
          <Input {...control} name="visitor_phone" type="tel" placeholder="+919876543210" />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vehicle number" htmlFor="vehicle_number">
          {(control) => <Input {...control} name="vehicle_number" placeholder="KA 01 AB 1234" />}
        </Field>
        <Field label="Purpose" htmlFor="purpose">
          {(control) => <Input {...control} name="purpose" placeholder="Dinner" />}
        </Field>
      </div>

      {units.length > 1 ? (
        <Field label="Visiting which unit?" htmlFor="unit_id">
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

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
