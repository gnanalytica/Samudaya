'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { formatMoney } from '@samudaya/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE } from '@/lib/action-state';
import { createEvent, type EventFormState } from '../actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create draft'}
    </Button>
  );
}

/** "Diwali 2026" → "diwali-2026" */
function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

const STARTER_BUDGET = [
  { category: 'Decoration', amount: '' },
  { category: 'Food', amount: '' },
  { category: 'Sound & lights', amount: '' },
];

export function CreateEventForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<EventFormState, FormData>(createEvent, EMPTY_STATE);
  const [name, setName] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [lines, setLines] = useState(STARTER_BUDGET);
  const total = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <Card>
        <CardHeader title="The event" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[5rem_1fr]">
            <Field label="Emoji" htmlFor="ne-emoji">
              {(control) => (
                <Input
                  {...control}
                  name="emoji"
                  defaultValue="🎉"
                  maxLength={4}
                  className="text-center"
                />
              )}
            </Field>
            <Field label="Name" htmlFor="ne-name" error={state.fieldErrors?.name} required>
              {(control) => (
                <Input
                  {...control}
                  name="name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!slugTouched) setEventSlug(slugify(event.target.value));
                  }}
                  placeholder="Diwali 2026"
                  required
                />
              )}
            </Field>
          </div>
          <Field
            label="Web address"
            htmlFor="ne-slug"
            error={state.fieldErrors?.slug}
            hint="Lowercase letters, numbers and hyphens."
            required
          >
            {(control) => (
              <Input
                {...control}
                name="event_slug"
                value={eventSlug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setEventSlug(event.target.value);
                }}
                required
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="ne-start" error={state.fieldErrors?.starts_on} required>
              {(control) => <Input {...control} name="starts_on" type="date" required />}
            </Field>
            <Field label="Ends" htmlFor="ne-end" error={state.fieldErrors?.ends_on}>
              {(control) => <Input {...control} name="ends_on" type="date" />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Venue" htmlFor="ne-venue">
              {(control) => <Input {...control} name="venue" placeholder="Clubhouse" />}
            </Field>
            <Field label="Organised by" htmlFor="ne-org">
              {(control) => (
                <Input {...control} name="organizer" placeholder="Cultural committee" />
              )}
            </Field>
          </div>
          <Field label="Description" htmlFor="ne-desc">
            {(control) => <Textarea {...control} name="description" />}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Budget"
          description={`What you plan to spend. The total, ${formatMoney(total)}, becomes the fund target.`}
        />
        <CardBody className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`bl-cat-${index}`}>
                Category
              </label>
              <Input
                id={`bl-cat-${index}`}
                name="budget_category"
                value={line.category}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((l, i) =>
                      i === index ? { ...l, category: event.target.value } : l,
                    ),
                  )
                }
                placeholder="Category"
                className="flex-1"
              />
              <label className="sr-only" htmlFor={`bl-amt-${index}`}>
                Amount
              </label>
              <Input
                id={`bl-amt-${index}`}
                name="budget_amount"
                type="number"
                min={0}
                value={line.amount}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((l, i) => (i === index ? { ...l, amount: event.target.value } : l)),
                  )
                }
                placeholder="₹"
                className="w-32"
              />
              <button
                type="button"
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                className="text-ink-subtle hover:text-ink p-1.5"
                aria-label={`Remove ${line.category || 'line'}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLines((current) => [...current, { category: '', amount: '' }])}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a line
          </Button>
        </CardBody>
      </Card>

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}
