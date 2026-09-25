import { MessageSquare } from 'lucide-react';
import { relativeTime } from '@samudaya/core';
import { getSupabase } from '@/lib/supabase/server';
import { CommentForm, DeleteCommentButton } from './comment-forms';

export type CommentSubject = { eventId: string } | { suggestionId: string };

/**
 * The thread hanging off one event or one suggestion.
 *
 * A vote with no discussion is a poll. This is the other half: the argument
 * that produced the decision, kept next to it and searchable, instead of
 * scrolled away in a WhatsApp group where nobody can find it next year.
 */
export async function CommentThread({
  slug,
  subject,
  myMembershipId,
  canModerate,
  /** Folded away until asked for, on a card that is already busy. */
  collapsed = false,
  title = 'Discussion',
  eventSlug,
}: {
  slug: string;
  subject: CommentSubject;
  myMembershipId: string;
  canModerate: boolean;
  collapsed?: boolean;
  title?: string;
  /** So the page this thread is on is the page that gets refreshed. */
  eventSlug?: string;
}) {
  const supabase = await getSupabase();
  const query = supabase
    .from('comments')
    .select(
      'id, body, created_at, membership_id, memberships!comments_membership_id_fkey(profiles(full_name))',
    )
    .order('created_at')
    .limit(200);

  const { data } = await ('eventId' in subject
    ? query.eq('event_id', subject.eventId)
    : query.eq('suggestion_id', subject.suggestionId));

  const comments = data ?? [];
  const body = (
    <div className="space-y-3">
      {comments.length ? (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink-subtle text-xs">
                  <span className="text-ink font-medium">
                    {comment.membership_id === myMembershipId
                      ? 'You'
                      : (comment.memberships?.profiles?.full_name ?? 'A resident')}
                  </span>{' '}
                  · {relativeTime(comment.created_at)}
                </p>
                <p className="text-ink mt-0.5 text-sm whitespace-pre-line">{comment.body}</p>
              </div>
              {comment.membership_id === myMembershipId || canModerate ? (
                <DeleteCommentButton slug={slug} commentId={comment.id} eventSlug={eventSlug} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-subtle text-sm">Nothing said yet.</p>
      )}
      <CommentForm slug={slug} subject={subject} eventSlug={eventSlug} />
    </div>
  );

  if (!collapsed) return body;

  return (
    <details className="group mt-3">
      <summary className="text-ink-muted hover:text-ink flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <MessageSquare className="size-3.5" aria-hidden="true" />
        {comments.length
          ? `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`
          : title}
      </summary>
      <div className="border-border-base mt-3 border-t pt-3">{body}</div>
    </details>
  );
}
