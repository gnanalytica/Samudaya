'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { askToChangeFlat } from './actions';

export type FlatChoice = { id: string; block: string | null; number: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Ask the committee'}
    </Button>
  );
}

/**
 * "I have moved" — the resident asks, the committee answers.
 *
 * Which flat somebody lives in is not theirs to set: it decides who the ledger
 * names against their money and who the directory lists at that door. But they
 * are the one who knows, and before this they could watch every payment they
 * made carry the wrong flat and have no way to mention it in the app.
 *
 * Shown to everyone, including the committee, who can also just do it from the
 * People page. Two doors to the same room is better than a committee member
 * wondering why the page that edits their name will not edit their flat.
 */
export function FlatCard({
  slug,
  current,
  units,
  pending,
}: {
  slug: string;
  current: string;
  units: FlatChoice[];
  /** What they have already asked for and are waiting on, if anything. */
  pending: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(askToChangeFlat, EMPTY_STATE);
  const [choice, setChoice] = useState('');
  const towers = [...new Set(units.map((unit) => unit.block ?? ''))];

  return (
    <Card>
      <CardHeader
        title="Your flat"
        description={
          pending
            ? `You have asked to be listed at ${pending}. The committee will confirm it.`
            : 'The committee confirms a change, because your flat is what the money pages name you by.'
        }
      />
      <CardBody>
        <p className="text-ink-muted mb-4 text-sm">
          Listed at <span className="text-ink font-medium">{current}</span>
        </p>
        <form action={action} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <Field label="Move me to" htmlFor="flat-choice" required>
            {(control) => (
              <Select
                {...control}
                name="unit_id"
                value={choice}
                onChange={(event) => setChoice(event.target.value)}
              >
                <option value="">I no longer live in a flat here</option>
                {towers.map((tower) =>
                  tower ? (
                    <optgroup key={tower} label={`Tower ${tower}`}>
                      {units
                        .filter((unit) => (unit.block ?? '') === tower)
                        .map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.block} {unit.number}
                          </option>
                        ))}
                    </optgroup>
                  ) : (
                    units
                      .filter((unit) => !unit.block)
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.number}
                        </option>
                      ))
                  ),
                )}
              </Select>
            )}
          </Field>
          <Field
            label="Anything the committee should know"
            htmlFor="flat-note"
            hint="Optional — when you moved, who you swapped with."
          >
            {(control) => <Input {...control} name="note" maxLength={300} />}
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
      </CardBody>
    </Card>
  );
}
