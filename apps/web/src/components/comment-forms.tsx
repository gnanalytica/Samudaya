'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { deleteComment, postComment } from '@/app/app/[community]/events/actions';
import type { CommentSubject } from './comment-thread';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Posting…' : 'Post'}
    </Button>
  );
}

export function CommentForm({
  slug,
  subject,
  eventSlug,
}: {
  slug: string;
  subject: CommentSubject;
  /** So the page this thread is on is the page that gets refreshed. */
  eventSlug?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(postComment, EMPTY_STATE);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (formData) => {
        await action(formData);
        ref.current?.reset();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="slug" value={slug} />
      {eventSlug ? <input type="hidden" name="event" value={eventSlug} /> : null}
      {'eventId' in subject ? (
        <input type="hidden" name="event_id" value={subject.eventId} />
      ) : (
        <input type="hidden" name="suggestion_id" value={subject.suggestionId} />
      )}
      <label htmlFor={`comment-${'eventId' in subject ? subject.eventId : subject.suggestionId}`}>
        <span className="sr-only">Your comment</span>
        <Textarea
          id={`comment-${'eventId' in subject ? subject.eventId : subject.suggestionId}`}
          name="body"
          rows={2}
          maxLength={2000}
          placeholder="Say what you think…"
          required
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}

export function DeleteCommentButton({
  slug,
  commentId,
  eventSlug,
}: {
  slug: string;
  commentId: string;
  eventSlug?: string;
}) {
  return (
    <form action={deleteComment}>
      <input type="hidden" name="slug" value={slug} />
      {eventSlug ? <input type="hidden" name="event" value={eventSlug} /> : null}
      <input type="hidden" name="comment_id" value={commentId} />
      <button
        type="submit"
        className="text-ink-subtle hover:text-danger p-1"
        aria-label="Delete this comment"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
