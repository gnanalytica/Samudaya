'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { createCommunity, type CreateState } from './actions';

const initial: CreateState = {};

/** "Green Valley Apartments" → "green-valley-apartments" */
function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create community'}
    </Button>
  );
}

export function CreateCommunityForm() {
  const [state, action] = useActionState(createCommunity, initial);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  // Stop auto-filling the address once the user has edited it themselves.
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <Field label="Community name" htmlFor="name" error={state.fieldErrors?.name} required>
        {(control) => (
          <Input
            {...control}
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            placeholder="Green Valley Apartments"
            required
          />
        )}
      </Field>

      <Field
        label="Web address"
        htmlFor="slug"
        error={state.fieldErrors?.slug}
        hint={`samudaya.app/app/${slug || 'your-community'}`}
        required
      >
        {(control) => (
          <Input
            {...control}
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            placeholder="green-valley"
            required
          />
        )}
      </Field>

      <Field label="City" htmlFor="city" error={state.fieldErrors?.city}>
        {(control) => <Input {...control} name="city" placeholder="Bengaluru" />}
      </Field>

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <Submit />
      <p className="text-ink-subtle text-xs">
        You’ll be the owner. You can invite everyone else with codes afterwards.
      </p>
    </form>
  );
}
