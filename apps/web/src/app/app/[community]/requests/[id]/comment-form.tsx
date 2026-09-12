'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { addComment } from '../actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Sending…' : 'Reply'}
    </Button>
  );
}

export function CommentForm({
  slug,
  requestId,
  canAddInternal,
}: {
  slug: string;
  requestId: string;
  canAddInternal: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(addComment, EMPTY_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="request_id" value={requestId} />
      <label htmlFor="comment-body" className="sr-only">
        Add a reply
      </label>
      <Textarea
        id="comment-body"
        name="body"
        rows={3}
        placeholder="Add an update…"
        required
        aria-invalid={state.fieldErrors?.body ? true : undefined}
      />
      {state.fieldErrors?.body ? (
        <p role="alert" className="text-danger text-xs">
          {state.fieldErrors.body}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-danger text-xs">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        {canAddInternal ? (
          <label className="text-ink-muted flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_internal"
              className="border-border-strong size-4 rounded"
            />
            Internal note — the resident won’t see this
          </label>
        ) : (
          <span />
        )}
        <Submit />
      </div>
    </form>
  );
}
